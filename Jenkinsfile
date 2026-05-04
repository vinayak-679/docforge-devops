pipeline {
    agent any

    stages {

        stage('Clean Workspace') {
            steps {
                deleteDir()
            }
        }

        stage('Deploy to App Server') {
            steps {
                sh '''
                ssh -i ~/.ssh/SSH_Key.pem -o StrictHostKeyChecking=no ubuntu@34.227.81.35 << 'EOF'

                cd ~
                
                echo 'If repo not present → clone'
                if [ ! -d "docforge-devops" ]; then
                    git clone git@github.com:vinayak-679/docforge-devops.git
                fi

                cd docforge-devops

                echo 'Pull latest changes'
                git pull origin main

                echo 'Stop old containers'
                docker compose down

                echo 'Build new containers & start new containers'
                docker compose up -d --build
                '''
            }
        }

        stage('Verify Running Containers') {
            steps {
                sh '''
                    docker ps
                '''
            }
        }
    }

    post {
        success {
            echo 'Deployment Successful using Docker Compose!'
        }

        failure {
            echo 'Deployment Failed!'
        }
    }
}