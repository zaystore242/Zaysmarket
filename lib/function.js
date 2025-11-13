const axios = require('axios')
const { 
    domain, apikey
} = require ('../setting')
const PTERO_DOMAIN = domain;
const PTERO_APPLICATION_API_KEY = apikey;


const applicationHeaders = {
    'Authorization': `Bearer ${PTERO_APPLICATION_API_KEY}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
};

const createPterodactylUser = async (username, email, password, firstName, lastName, rootAdmin = false) => {
    try {
        const response = await axios.post(`${PTERO_DOMAIN}/api/application/users`, {
            username: username,
            email: email,
            first_name: firstName,
            last_name: lastName,
            password: password,
            root_admin: rootAdmin
        }, { headers: applicationHeaders });
        return response.data.attributes;
    } catch (error) {
        if (error.response && error.response.data && error.response.data.errors) {
            throw new Error(`Gagal membuat pengguna Pterodactyl: ${error.response.data.errors[0].detail}`);
        }
        throw new Error(`Gagal membuat pengguna Pterodactyl: ${error.message}`);
    }
};

const createPterodactylServer = async (serverName, userId, nestId, eggId, dockerImage, startupCmd, memory, disk, cpu, environment = {}) => {
    try {
        const response = await axios.post(`${PTERO_DOMAIN}/api/application/servers`, {
            name: serverName,
            user: userId,
            nest: nestId,
            egg: eggId,
            docker_image: dockerImage,
            startup: startupCmd,
            limits: {
                memory: memory,
                disk: disk,
                cpu: cpu,
                swap: 0,
                io: 500
            },
            feature_limits: {
                databases: 5,
                backups: 5,
                allocations: 2
            },
            deploy: {
                locations: [1],
                dedicated_ip: false,
                port_range: []
            },
            allocation: {
                default: 1
            },
            environment: environment
        }, { headers: applicationHeaders });

        if (!response.data.attributes || !response.data.attributes.limits) {
            throw new Error('Respons Pterodactyl tidak mengandung data spesifikasi server yang valid.');
        }

        return response.data.attributes;
    } catch (error) {
        if (error.response && error.response.data && error.response.data.errors) {
            throw new Error(`Gagal membuat server Pterodactyl: ${error.response.data.errors[0].detail}`);
        }
        throw new Error(`Gagal membuat server Pterodactyl: ${error.message}`);
    }
};

module.exports = { 
    createPterodactylUser,
    createPterodactylServer
}