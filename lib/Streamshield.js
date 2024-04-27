import fetch from 'node-fetch';
import crypto from 'crypto';
import envPaths from 'env-paths';
import { promises as fs } from 'fs';
import path from 'path';

const ADMINISTRATION_API_URL = 'https://api.streamshield.ai/';
const MODERATION_API_URL = 'https://moderation.streamshield.ai/';
const ADMINISTRATION_SANDBOX_API_URL = 'https://api.dev.streamshield.ai/';
const MODERATION_SANDBOX_API_URL = 'https://moderation.dev.streamshield.ai/';

const paths = envPaths('StreamShield');

export default class Streamshield {
    constructor() {
        this.apiKey = null;
        this.secretKey = null;
        this.sandbox = false;
    }

    setApiKey(key, secret) {
        if (this.isString(key) && this.isString(secret)) {   
            this.apiKey = key
            this.secretKey = secret
        } else {
            console.error("[Streamshield] Missing Access Key or Secret Key")
        }
    }

    setSandboxMode() {
        this.sandbox = true
    }

    isString(value) {
        return typeof value === 'string' || value instanceof String;
    }

    getAdministrationUrl() {
        if(this.sandbox) {
            return ADMINISTRATION_SANDBOX_API_URL
        } else {
            return ADMINISTRATION_API_URL
        }
    }

    getModerationUrl() {
        if(this.sandbox) {
            return MODERATION_SANDBOX_API_URL
        } else {
            return MODERATION_API_URL
        }
    }

    urlSafeB64DecodeNode(str) {
        let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        const padding = (4 - (base64.length % 4)) % 4;
        base64 += '='.repeat(padding);
        return Buffer.from(base64, 'base64').toString('binary');
    }

    urlSafeB64EncodeNode(str) {
        return Buffer.from(str, 'base64').toString('base64')
            .replace(/\+/g, '-').replace(/\//g, '_') //.replace(/=+$/, '');
    }

    formatData(data) {
        // Sorting the keys of the object
        const sortedData = {};
        Object.keys(data).sort().forEach(key => {
            sortedData[key] = data[key];
        });
    
        const dataString = JSON.stringify(sortedData);
    
        return dataString;
    }

    checkFileHash(data, signature) {
        // data = file path
        // signature = the signature from SS
        const bSecret = this.urlSafeB64DecodeNode(this.secretKey)
        // Make a new signature based on the path
        const signatureCheck = crypto.createHmac('sha256', Buffer.from(bSecret, 'binary'));
        signatureCheck.update(data);
        const base64Hash =  signatureCheck.digest('base64'); // Directly get base64-encoded output
        const urlSafeHash = this.urlSafeB64EncodeNode(base64Hash);
        // Compare this with the signature sent from SS
        return urlSafeHash === signature;
    }

    async generateSignature(data) {
        try {
            const bData = this.formatData(data);
            const bSecret = this.urlSafeB64DecodeNode(this.secretKey);

            const hmac = crypto.createHmac('sha256', Buffer.from(bSecret, 'binary'));
            hmac.update(bData);
            
            const base64Hash =  hmac.digest('base64'); // Directly get base64-encoded output
            const urlSafeHash = this.urlSafeB64EncodeNode(base64Hash);
        
            return urlSafeHash
        
        } catch (error) {
            throw error;
        }
    }
    
    async register (cmsName, cmsVersion, pluginVersion) {
        try {
            const data = {
                "cms_name": cmsName,
                "cms_version": cmsVersion,
                "plugin_version": pluginVersion
            }
            const bData = this.formatData(data);
            const signature = await this.generateSignature(data)
            
            const url = `${this.getAdministrationUrl()}plugins?access_key=${this.apiKey}&signature=${signature}`
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: bData
            });

            if (!response.ok) {
                const message = await response.text()
                throw new Error(`${response.status} - ${message}`);
            }

            const responseData = await response.json();

            if(responseData.data && responseData.data.tenant_id) {
                await fs.mkdir(paths.config, { recursive: true });
                const configFile = path.join(paths.config, 'tenant.json');
                await fs.writeFile(configFile, JSON.stringify(responseData.data, null, 2), 'utf8');
                return true;
            } else {
                throw new Error('Tenant ID not found')
            }

            
        } catch (error) {
            throw error;
        }
    }

    async getTenantId() {
        try {
            const configFile = path.join(paths.config, 'tenant.json');
            const data = await fs.readFile(configFile, 'utf8');
            return JSON.parse(data).tenant_id;
        } catch (err) {
            throw new Error('Tenant not found. Please Register first')
        }
    }

    async moderate (meta, fields) {
        try {
            const tenantId = await this.getTenantId()
            let d = new Date().toISOString()
            d = d.replace('Z', '+00:00') // To mimic PHP
            const data = {
                streamshield_meta: {
                    ...meta,
                    access_key: this.apiKey,
                    tenant_id: tenantId,
                    utc_datetime: d
                }
            }
            for(const field of fields) {
                data[field.id] = {
                    ...field
                }
                delete data[field.id].id // remove the ID from payload
            }
            const bData = this.formatData(data);
            const signature = await this.generateSignature(data.streamshield_meta)
            const url = `${this.getModerationUrl()}?access_key=${this.apiKey}&signature=${signature}`
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: bData
            });

            if (!response.ok) {
                const message = await response.text()
                throw new Error(`${response.status} - ${message}`);
            }
            const responseData = await response.text();

            return true

        } catch (error) {
            throw error;
        }
    }
}