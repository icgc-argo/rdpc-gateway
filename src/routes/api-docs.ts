import express from 'express';
import * as swaggerUi from 'swagger-ui-express';
import yaml from 'yamljs';
import path from 'path';

export default () => {
  const router = express.Router();

  const mainDoc = yaml.load(path.join(__dirname, '../resources/swagger/index.yaml'));

  // Sort the tag orders alphabetically
  mainDoc.tags = mainDoc.tags.sort((a: { name: string }, b: { name: string }) =>
    a.name > b.name ? 1 : -1,
  );

  router.use('/', swaggerUi.serve, swaggerUi.setup(mainDoc));

  return router;
};
