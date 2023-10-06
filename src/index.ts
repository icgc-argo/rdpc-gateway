/*
 * Copyright (c) 2023The Ontario Institute for Cancer Research. All rights reserved
 *
 * This program and the accompanying materials are made available under the terms of the GNU Affero General Public License v3.0.
 * You should have received a copy of the GNU Affero General Public License along with
 * this program. If not, see <http://www.gnu.org/licenses/>.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
 * SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
 * IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { ApolloServer } from 'apollo-server-express';
import { ApolloGateway, RemoteGraphQLDataSource } from '@apollo/gateway';
import express, { Request } from 'express';
import * as dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';
import fetch from 'node-fetch';

import apiDocRouter from './routes/api-docs';
import clinicalProxyRoute from './routes/clinical-proxy';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

const GRAPHQ_GQL_PATH = '/graphql';
const WORKFLOW_API_URL = process.env.WORKFLOW_API_URL;
const SONG_SEARCH_URL = process.env.SONG_SEARCH_URL;
const CLINICAL_GQL_URL = process.env.CLINICAL_GQL_URL;

// *** Setup Apollo Federation ***
const gateway = new ApolloGateway({
  serviceList: [
    {
      name: 'workflow-api',
      url: `${WORKFLOW_API_URL}${GRAPHQ_GQL_PATH}`,
    },
    {
      name: 'song-search',
      url: `${SONG_SEARCH_URL}${GRAPHQ_GQL_PATH}`,
    },
    {
      name: 'argo-clinical',
      url: `${CLINICAL_GQL_URL}${GRAPHQ_GQL_PATH}`,
    },
  ],
  buildService({ name, url }) {
    return new RemoteGraphQLDataSource({
      url,
      willSendRequest({ request, context }) {
        request.http.headers.set('authorization', context.authorization);
      },
    });
  },
});

const server = new ApolloServer({
  gateway,
  // Disable subscriptions (not currently supported with ApolloGateway)
  subscriptions: false,
  context: ({ req }: { req: Request }) => ({
    authorization: req.headers?.authorization || '',
  }),
});

// *** Setup Workflow-API proxy ***
// Workflow-Api graphql is accessed via Apollo, so reject here

app.use('/workflow-api/graphql', (_, res) => res.status(404).send());
app.use('/workflow-api/v2/api-docs', async (req, res) => {
  // api-docs has no knowledge of proxy so it points to actual service which is misleading
  // since we are proxying through gateway, replace with gateway's host and basePath

  const apiDoc = await fetch(WORKFLOW_API_URL + '/v2/api-docs').then((res) => res.json());
  apiDoc.host = `${req.hostname}:${port}`;
  apiDoc.basePath = '/workflow-api';
  res.send(apiDoc);
});

app.use(
  '/workflow-api',
  createProxyMiddleware({
    target: WORKFLOW_API_URL,
    xfwd: true,
    pathRewrite: (path: string, _) => path.replace('/workflow-api', ''),
    changeOrigin: true,
  }),
);

// *** Setup Health Endpoint ***
app.use('/status', (_, res) => {
  return res.send({
    status: 'RUNNING',
  });
});

// Routers
app.use('/clinical', clinicalProxyRoute);

app.use('/api-docs', apiDocRouter());

server.applyMiddleware({ app });

app.listen(port, () => {
  console.log(`Server ready at http://localhost:${port}${server.graphqlPath}`);
  console.log(`🛩  Rest API doc available at http://localhost:${port}/api-docs`);
});
