const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const moment = require("moment-timezone");
const axios = require("axios");
const cloudscraper = require("cloudscraper");
const qs = require("querystring");
const router = express.Router();

const { createPterodactylUser, createPterodactylServer } = require("../lib/function");
const { domain, atlakey, apikey } = require("../setting");

const PTERO_DOMAIN = domain;
const PTERO_APPLICATION_API_KEY = apikey;
const API_KEY = atlakey;

const MONGO_URI = "mongodb+srv://gini:ggoktkkyoAnfTF0O@hiro.pwhagfj.mongodb.net/dalangstore?retryWrites=true&w=majority&appName=Hiro";
const User = mongoose.model("User");

const priceList = {
    '1gb': 1000, '2gb': 2000, '3gb': 3000, '4gb': 4000,
    '5gb': 5000, '6gb': 6000, '7gb': 7000, '8gb': 8000,
    '9gb': 9000, '10gb': 10000, 'unli': 11000
};

const successfulOrders = {};

async function createServerLogic(orderDetails) {
    const { serverName, size, platform, max_players } = orderDetails;
    
    let ram, disk, cpu;
    switch (size) {
        case '1gb': ram = 1024; disk = 1024; cpu = 50; break;
        case '2gb': ram = 2048; disk = 2048; cpu = 100; break;
        case '3gb': ram = 3072; disk = 3072; cpu = 150; break;
        case '4gb': ram = 4096; disk = 4096; cpu = 200; break;
        case '5gb': ram = 5120; disk = 5120; cpu = 250; break;
        case '6gb': ram = 6144; disk = 6144; cpu = 300; break;
        case '7gb': ram = 7168; disk = 7168; cpu = 350; break;
        case '8gb': ram = 8192; disk = 8192; cpu = 400; break;
        case '9gb': ram = 9216; disk = 9216; cpu = 450; break;
        case '10gb': ram = 10240; disk = 10240; cpu = 500; break;
        case 'unli': ram = 0; disk = 0; cpu = 0; break;
        default: throw new Error('Ukuran server tidak valid.');
    }

    let nestId, eggId, dockerImage, startupCmd, environment = {};
    
    switch (platform) {
        case 'nodejs':
            nestId = 5; eggId = 15; dockerImage = "ghcr.io/parkervcp/yolks:nodejs_23";
            startupCmd = "if [[ -d .git ]] && [[ {{AUTO_UPDATE}} == \"1\" ]]; then git pull; fi; if [[ ! -z ${NODE_PACKAGES} ]]; then \\/usr\\/local\\/bin\\/npm install ${NODE_PACKAGES}; fi; if [[ ! -z ${UNNODE_PACKAGES} ]]; then \\/usr\\/local\\/bin\\/npm uninstall ${UNNODE_PACKAGES}; fi; if [ -f \\/home\\/container\\/package.json ]; then \\/usr\\/local\\/bin\\/npm install; fi;  if [[ ! -z ${CUSTOM_ENVIRONMENT_VARIABLES} ]]; then   vars=$(echo ${CUSTOM_ENVIRONMENT_VARIABLES} | tr \";\" \"\\n\");   for line in $vars;  do export $line;  done fi;  \\/usr\\/local\\/bin\\/${CMD_RUN};";
            environment = { INST: "npm", USER_UPLOAD: "0", AUTO_UPDATE: "0", CMD_RUN: "npm start", JS_FILE: "index.js" };
            break;
        case 'linux':
            nestId = 6; eggId = 17; dockerImage = "ghcr.io/parkervcp/games:samp";
            startupCmd = "./samp03svr";
            environment = { MAX_PLAYERS: max_players };
            break;
        case 'windows':
            nestId = 6; eggId = 16; dockerImage = "hcgcloud/pterodactyl-images:ubuntu-wine";
            startupCmd = "wine64 ./samp-server.exe";
            environment = { MAX_PLAYERS: max_players };
            break;
        default: throw new Error('Platform tidak valid.');
    }

    try {
        const username = serverName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() + Math.floor(Math.random() * 1000);
        const email = `${username}@example.com`;
        const password = crypto.randomBytes(12).toString('base64');
        const user = await createPterodactylUser(username, email, password, username, 'User');

        if (!user || !user.id) throw new Error('Gagal membuat user Pterodactyl atau user ID tidak ditemukan.');
        
        const server = await createPterodactylServer(serverName, user.id, nestId, eggId, dockerImage, startupCmd, ram, disk, cpu, environment);
        
        if (!server || !server.id) throw new Error('Fungsi createPterodactylServer tidak mengembalikan data server yang valid.');

        return {
            user: user,
            server: server,
            credentials: { password: password, login_url: PTERO_DOMAIN }
        };

    } catch (error) {
        console.error(`Error kritis saat proses pembuatan server untuk "${serverName}":`, error.message);
        throw error;
    }
}

async function checkDepositStatus(depositId, orderDetails) {
    try {
        const formData = qs.stringify({ api_key: API_KEY, id: depositId });
        const response = await cloudscraper({
            method: "POST", url: "https://atlantich2h.com/deposit/status",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData
        });
        const apiRes = JSON.parse(response);

        if (apiRes.status && apiRes.data.status === 'success') {
            try {
                const creationResult = await createServerLogic(orderDetails);
                successfulOrders[depositId] = creationResult;
                console.log(`Server "${creationResult.server.name}" berhasil dibuat dan detail disimpan untuk deposit ID ${depositId}.`);
            } catch (creationError) {
                successfulOrders[depositId] = { error: creationError.message };
                console.error(`PEMBAYARAN SUKSES TAPI GAGAL MEMBUAT SERVER untuk deposit ID ${depositId}. Error:`, creationError.message);
            }
            return;
        } else if (apiRes.status && (apiRes.data.status === 'canceled' || apiRes.data.status === 'expired')) {
            return;
        } else {
            setTimeout(() => checkDepositStatus(depositId, orderDetails), 15000);
        }
    } catch (err) {
        setTimeout(() => checkDepositStatus(depositId, orderDetails), 15000);
    }
}

router.post('/order/create-server', async (req, res) => {
    const { serverName, size, platform, max_players } = req.body;
    if (!size || !platform || !serverName) return res.status(400).json({ status: false, msg: 'Data spesifikasi atau nama server tidak lengkap.' });
    const nominal = priceList[size];
    if (!nominal) return res.status(400).json({ status: false, msg: 'Ukuran server tidak valid.' });
    try {
        const reff_id = "REF" + Date.now();
        const depositFormData = qs.stringify({
          api_key: API_KEY, reff_id, nominal, type: "ewallet", metode: "qrisfast"
        });
        const depositResponse = await cloudscraper({
          method: "POST", url: "https://atlantich2h.com/deposit/create",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: depositFormData
        });
        const apiRes = JSON.parse(depositResponse);
        if (!apiRes.status || !apiRes.data || !apiRes.data.id) {
            return res.status(500).json({ status: false, msg: apiRes.msg || 'Gagal membuat permintaan deposit.' });
        }
        res.json({ status: true, data: apiRes.data });
        setTimeout(() => { checkDepositStatus(apiRes.data.id, req.body); }, 5000);
    } catch (err) {
        res.status(500).json({ status: false, msg: "Terjadi kesalahan internal", error: err.message });
    }
});

router.get("/deposit/status", async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ status: false, msg: "ID Deposit wajib diisi" });
    const formData = qs.stringify({ api_key: API_KEY, id });
    const response = await cloudscraper({
      method: "POST", url: "https://atlantich2h.com/deposit/status",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData
    });
    const apiRes = JSON.parse(response);

    if (apiRes.status && apiRes.data.status === 'success' && successfulOrders[id]) {
        apiRes.data.serverDetails = successfulOrders[id];
        delete successfulOrders[id];
    }
    res.json(apiRes);
  } catch (err) {
    res.status(500).json({ status: false, msg: "Terjadi kesalahan", error: err.message });
  }
});

router.get("/deposit/cancel", async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ status: false, msg: "ID Deposit wajib diisi" });
    const formData = qs.stringify({ api_key: API_KEY, id });
    const response = await cloudscraper({
      method: "POST", url: "https://atlantich2h.com/deposit/cancel",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData
    });
    res.json(JSON.parse(response));
  } catch (err) {
    return res.status(500).json({ status: false, msg: "Terjadi kesalahan", error: err.message });
  }
});

module.exports = router;