const apiClient = require('./api-clients').extensionsV1beta1Api;

const namespace = 'default';

module.exports = {
    create: async deployment => apiClient.createNamespacedDeployment(namespace, deployment.getSpec()),
    delete: async deploymentName => apiClient.deleteNamespacedDeployment(deploymentName, namespace, undefined, {
        propagationPolicy: 'Background',
    }),
    scale: async (deploymentName, scale) => apiClient.patchNamespacedDeployment(
        deploymentName,
        namespace,
        {
            spec: {
                replicas: scale,
            },
        },
        undefined,
        undefined,
        {
            headers: {
                'Content-Type': 'application/strategic-merge-patch+json',
            },
        }
    ),
    updateImage: async (deploymentName, containerName, image) => apiClient.patchNamespacedDeployment(
        deploymentName,
        namespace,
        {
            spec: {
                template: {
                    spec: {
                        containers: [{
                            name: containerName,
                            image,
                        }],
                    },
                },
            },
        },
        undefined,
        undefined,
        {
            headers: {
                'Content-Type': 'application/strategic-merge-patch+json',
            },
        }
    ),
};
