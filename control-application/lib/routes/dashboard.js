const k8s = require('@kubernetes/client-node');

module.exports = async (req, res) => {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();

    const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);
    const k8sExtensionsApi = kc.makeApiClient(k8s.ExtensionsV1beta1Api);

    const podListResponse = await k8sCoreApi.listNamespacedPod('default');

    const pods = await Promise.all(podListResponse.body.items.map(async (pod) => {
        // The pod status isn't what it claims to be.
        // https://github.com/kubernetes/kubernetes/issues/22839
        pod.status.phase = pod.metadata.deletionTimestamp !== undefined ? 'Terminating' : pod.status.phase;

        let logLines = [];
        if (pod.status.phase === 'Running') {
            const logsResponse = await k8sCoreApi.readNamespacedPodLog(pod.metadata.name, 'default', 'js-app');
            logLines = logsResponse.body ? logsResponse.body.split('\n') : [];
        }
        const numErrors = logLines.filter(line => line.toLowerCase().includes('error')).length;

        return {
            name: pod.metadata.name,
            status: pod.status.phase,
            label: pod.metadata.labels.app,
            logLines,
            numErrors,
        };
    }));

    const deploymentsResponse = await k8sExtensionsApi.listNamespacedDeployment('default');
    const deployments = deploymentsResponse.body.items.map(deployment => ({
        templateLabels: deployment.spec.template.metadata.labels,
        containers: deployment.spec.template.spec.containers,
        name: deployment.metadata.name,
        pods: pods.filter(pod => pod.label === deployment.spec.selector.matchLabels.app),
        readyReplicas: deployment.status.readyReplicas,
        scale: deployment.spec.replicas,
        updatedReplicas: deployment.status.updatedReplicas,
    }));

    const servicesResponse = await k8sCoreApi.listNamespacedService('default');
    const services = servicesResponse.body.items.map(service => ({
        name: service.metadata.name,
        selector: service.spec.selector,
    }));

    const ingressesResponse = await k8sExtensionsApi.listNamespacedIngress('default');
    const ingresses = ingressesResponse.body.items.map((ingress) => {
        let ip;
        if (ingress.status.loadBalancer.ingress && ingress.status.loadBalancer.ingress[0]) {
            ip = ingress.status.loadBalancer.ingress[0].ip;
        }

        let hosts = [];
        if (ip) {
            hosts = ingress.spec.rules.map(rule => rule.host).filter(host => host);
            if (hosts.length === 0) {
                hosts = [ip];
            }
        }

        return {
            name: ingress.metadata.name,
            hosts,
        };
    });

    res.json({
        deployments,
        services,
        ingresses,
    });
};
