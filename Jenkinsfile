def dockerRepo = "ghcr.io/icgc-argo/rdpc-gateway"
def gitHubRepo = "icgc-argo/rdpc-gateway"
def chartVersion = "1.2.0"
def commit = "UNKNOWN"
def version = "UNKNOWN"
def uikitVersion = "UNKNOWN"


pipeline {
    agent {
        kubernetes {
            label 'rdpc-gateway'
            yaml """
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: node
    image: node:12.6.0
    tty: true
  - name: dind-daemon
    image: docker:18.06-dind
    securityContext:
        privileged: true
        runAsUser: 0
    volumeMounts:
      - name: docker-graph-storage
        mountPath: /var/lib/docker
  - name: helm
    image: alpine/helm:2.12.3
    command:
    - cat
    tty: true
  - name: docker
    image: docker:18-git
    tty: true
    env:
    - name: DOCKER_HOST
      value: tcp://localhost:2375
    - name: HOME
      value: /home/jenkins/agent
  securityContext:
    runAsUser: 1000
  volumes:
  - name: docker-graph-storage
    emptyDir: {}
"""
        }
    }
    stages {
        stage('Prepare') {
            steps {
                script {
                    commit = sh(returnStdout: true, script: 'git describe --always').trim()
                }
                script {
                    version = sh(returnStdout: true, script: 'cat ./package.json | grep version | cut -d \':\' -f2 | sed -e \'s/"//\' -e \'s/",//\'').trim()
                }
            }
        }
        stage('Build & Publish Develop') {
            when {
                branch "develop"
            }
            steps {
                container('docker') {
                    withCredentials([usernamePassword(credentialsId:'argoContainers', usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
                        sh 'docker login ghcr.io -u $USERNAME -p $PASSWORD'
                    }

                    // DNS error if --network is default
                    sh "docker build --network=host . -t ${dockerRepo}:edge -t ${dockerRepo}:${commit}"

                    sh "docker push ${dockerRepo}:${commit}"
                    sh "docker push ${dockerRepo}:edge"
                }
            }
        }
        stage('deploy to rdpc-collab-dev') {
            when {
                branch "develop"
            }
            steps {
                build(job: "/provision/helm", parameters: [
                     [$class: 'StringParameterValue', name: 'AP_RDPC_ENV', value: 'dev' ],
                     [$class: 'StringParameterValue', name: 'AP_CHART_NAME', value: 'rdpc-gateway'],
                     [$class: 'StringParameterValue', name: 'AP_RELEASE_NAME', value: 'rdpc-gateway'],
                     [$class: 'StringParameterValue', name: 'AP_HELM_CHART_VERSION', value: "${chartVersion}"],
                     [$class: 'StringParameterValue', name: 'AP_ARGS_LINE', value: "--set-string image.tag=${commit}" ]
                ])
            }
        }
        stage('Build & Publish Release') {
            when {
                branch "master"
            }
            steps {
                container('docker') {
                    withCredentials([usernamePassword(credentialsId: 'argoGithub', passwordVariable: 'GIT_PASSWORD', usernameVariable: 'GIT_USERNAME')]) {
                        sh "git tag ${version}"
                        sh "git push https://${GIT_USERNAME}:${GIT_PASSWORD}@github.com/${gitHubRepo} --tags"
                    }

                    withCredentials([usernamePassword(credentialsId:'argoContainers', usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
                        sh 'docker login ghcr.io -u $USERNAME -p $PASSWORD'
                    }

                    // DNS error if --network is default
                    sh "docker build --network=host . -t ${dockerRepo}:latest -t ${dockerRepo}:${version}"

                    sh "docker push ${dockerRepo}:${version}"
                    sh "docker push ${dockerRepo}:latest"
                }
            }
        }
        stage('deploy to rdpc-collab-qa') {
            when {
                branch "master"
            }
            steps {
                build(job: "/provision/helm", parameters: [
                     [$class: 'StringParameterValue', name: 'AP_RDPC_ENV', value: 'qa' ],
                     [$class: 'StringParameterValue', name: 'AP_CHART_NAME', value: 'rdpc-gateway'],
                     [$class: 'StringParameterValue', name: 'AP_RELEASE_NAME', value: 'rdpc-gateway'],
                     [$class: 'StringParameterValue', name: 'AP_HELM_CHART_VERSION', value: "${chartVersion}"],
                     [$class: 'StringParameterValue', name: 'AP_ARGS_LINE', value: "--set-string image.tag=${version}" ]
                ])
            }
        }
    }
}
