const { items } = require('onedrive-api');
const NodeCache = require('node-cache');
const qs = require('querystring');
const request = require('request-promise');
const get = require('lodash.get');

let instance = null;
const baseConfig = {
    authPath: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    stdTTLToken: 3000,
    stdTTLCreds: 43200,
    checkperiod: 1200,
};

const getAccessToken = Symbol('getAccessToken');
const config = Symbol('config');
const credsCache = Symbol('credsCache');
const parseKey = Symbol('parseKey');
const addToken = Symbol('addToken');
const checkToken = Symbol('checkToken');
const getByLink = Symbol('getByLink');
const isExpiredToken = Symbol('isExpiredToken');

class OneDriveUtil {
    constructor(options) {
        this[config] = { ...baseConfig, ...options };
        this[credsCache] = new NodeCache({
            stdTTL: this[config].stdTTLCreds,
            checkperiod: this[config].checkperiod,
        });
    }

    /**
     *
     * @static
     * @param {object} options ReqLimiter configuration options
     * @param {number}  options.stdTTLToken   - 3000 (s).
     * @param {number}  options.stdTTLCreds   - 43200 (s).
     * @param {number}  options.checkperiod   - 1200 (s).
     * @returns {ReqLimiter} instance of OneDrivePool
     * @memberof OneDriveUtil
     */
    static getInstance(options) {
        instance = instance || new OneDriveUtil(options);

        return instance;
    }
    async [getAccessToken](
        pool,
        { client_id, client_secret, redirect_uri, refresh_token },
    ) {
        const body = {
            client_id,
            client_secret,
            redirect_uri,
            refresh_token,
            grant_type: 'refresh_token',
        };

        const options = {
            method: 'POST',
            url: this[config].authPath,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: qs.stringify(body),
            json: true,
        };

        const { access_token } = await request(options);

        this[credsCache].set(
            this[parseKey](pool).token(),
            access_token,
            this[config].stdTTLToken,
        );

        return access_token;
    }
    [parseKey] = pool => {
        return {
            creds: () => `creds-${pool}`,
            token: () => `token-${pool}`,
            setData: key => `${key}-${pool}`,
        };
    };
    /**
     * @param {string} pool name of the pool you would like, of use
     * @returns {string} returns credential for your pool
     * @memberof OneDriveUtil
     */
    checkCreds = pool => {
        return this[credsCache].get(this[parseKey](pool).creds());
    };
    /**
     * @param {string} pool name of the pool you would like, of use
     * @param {object} creds One Drive account credentials
     * @param {string}  creds.client_id
     * @param {string}  creds.client_secret
     * @param {string}  creds.redirect_uri
     * @param {string}  creds.refresh_token
     * @returns {boolean} boolean
     * @memberof OneDriveUtil
     */
    addConection = async (pool, creds) => {
        this[credsCache].set(this[parseKey](pool).creds(), creds);
        await this[getAccessToken](pool, creds);

        return true;
    };

    [isExpiredToken] = error =>
        get(error, 'error.error.code') === 'InvalidAuthenticationToken';

    [addToken] = async pool => {
        const creds = this[credsCache].get(this[parseKey](pool).creds());

        if (!creds)
            throw new Error(
                'Not found creds for your pool, please make `addConection` method and try again',
            );
        const accessToken = await this[getAccessToken](pool, creds);

        return accessToken;
    };

    [checkToken] = async pool => {
        let accessToken = this[credsCache].get(this[parseKey](pool).token());
        if (!accessToken) {
            accessToken = await this[addToken](pool);
        }

        return accessToken;
    };
    /**
     * @param {object} params
     * @param {string}  params.pool - name of the pool you would like, of use
     * @param {string}  params.key - key for saving your data
     * @param {any}  params.data - data for save
     * @param {number}  params.ttl - ttl for your saving data
     * @returns {void} void
     * @memberof OneDriveUtil
     */
    setToCashe = ({ pool, key, data, ttl }) => {
        this[credsCache].set(this[parseKey](pool).setData(key), data, ttl);
    };

    /**
     * @param {object} params
     * @param {string}  params.pool - name of the pool you would like, of use
     * @param {string}  params.key - key for take your saved data
     * @memberof OneDriveUtil
     */
    getFromCashe = ({ pool, key }) => {
        return this[credsCache].get(this[parseKey](pool).setData(key));
    };

    items = {
        /**
         * @method listChildren
         * @description List childrens
         *
         * @param {Object} params
         * @param {String} params.pool - name of the pool you would like, of use
         * @param {String} [params.itemId=root] Item id
         * @param {Boolean} [params.shared] A flag to indicated whether this files is owned by the user or shared from another user. If true params.user has to be set.
         * @param {String} [params.user] The user who shared the file. Must be set if params.shared is true.
         * @param {String} [params.query] OData system query options.
         *
         * @return {Array} object of children items
         */
        listChildren: async (pool, params) => {
            try {
                const accessToken = await this[checkToken](pool);

                return await items.listChildren({ accessToken, ...params });
            } catch (error) {
                if (!this[isExpiredToken](error)) throw error;
                const accessToken = await this[addToken](pool);

                return await items.listChildren({ accessToken, ...params });
            }
        },
        /**
         * @method createFolder
         * @description Create Folder
         *
         * @param {Object} params
         * @param {String} params.pool - name of the pool you would like, of use
         * @param {String} [params.rootItemId=root] Root Item id
         * @param {String} params.name New folder name
         *
         * @return {Object} folder object
         */

        createFolder: async (pool, params) => {
            try {
                const accessToken = await this[checkToken](pool);

                return await items.createFolder({ accessToken, ...params });
            } catch (error) {
                if (!this[isExpiredToken](error)) throw error;
                const accessToken = await this[addToken](pool);

                return await items.createFolder({ accessToken, ...params });
            }
        },

        /**
         * @method uploadSimple
         * @description Create file with simple upload
         * @param {String} pool - name of the pool you would like, of use
         * @param {Object} params
         * @param {String} params.filename File name
         * @param {String} [params.parentId=root] Parent id
         * @param {Object} params.readableStream Readable Stream with file's content
         *
         * @return {Object} Item
         */
        uploadSimple: async (pool, params) => {
            try {
                const accessToken = await this[checkToken](pool);

                return await items.uploadSimple({ accessToken, ...params });
            } catch (error) {
                if (!this[isExpiredToken](error)) throw error;
                const accessToken = await this[addToken](pool);

                return await items.uploadSimple({ accessToken, ...params });
            }
        },

        /**
         * @method uploadSession
         * @description Create file with session upload
         *
         * @param {String} pool - name of the pool you would like, of use
         * @param {Object} params
         * @param {String} params.filename File name
         * @param {String} [params.parentId=root] Parent id
         * @param {String} [params.parentPath] Parent id
         * @param {Object} params.readableStream Readable Stream with file's content
         * @param {Number} params.fileSize Size of file
         * @param {Number} [params.chunksToUpload=20] Number of chunks to upload at a time
         *
         * @return {Object} Item
         */
        uploadSession: async (pool, params) => {
            try {
                const accessToken = await this[checkToken](pool);

                return await items.uploadSession({ accessToken, ...params });
            } catch (error) {
                if (!this[isExpiredToken](error)) throw error;
                const accessToken = await this[addToken](pool);

                return await items.uploadSession({ accessToken, ...params });
            }
        },

        /**
         * @method update
         * @description update item metadata
         *
         * @param {String} pool - name of the pool you would like, of use
         * @param {Object} params
         * @param {String} params.itemId Item id
         * @param {Object} params.toUpdate Object to update
         *
         * @return {Object} Item object
         */
        update: async (pool, params) => {
            try {
                const accessToken = await this[checkToken](pool);

                return await items.update({ accessToken, ...params });
            } catch (error) {
                if (!this[isExpiredToken](error)) throw error;
                const accessToken = await this[addToken](pool);

                return await items.update({ accessToken, ...params });
            }
        },

        /**
         * @method  getMetadata
         * @description Get items metadata (file or folder)
         *
         * @param {String} pool - name of the pool you would like, of use
         * @param {Object} params
         * @param {String} params.itemId Item id
         *
         * @return {Object} Item's metadata
         */
        getMetadata: async (pool, params) => {
            try {
                const accessToken = await this[checkToken](pool);

                return await items.getMetadata({ accessToken, ...params });
            } catch (error) {
                if (!this[isExpiredToken](error)) throw error;
                const accessToken = await this[addToken](pool);

                return await items.getMetadata({ accessToken, ...params });
            }
        },

        /**
         * @method download
         * @description Download item content
         *
         * @param {String} pool - name of the pool you would like, of use
         * @param {Object} params
         * @param {String} params.itemId item id
         *
         * @return {Object} Readable stream with item's content
         */
        download: async (pool, params) => {
            try {
                const accessToken = await this[checkToken](pool);

                return await items.download({ accessToken, ...params });
            } catch (error) {
                if (!this[isExpiredToken](error)) throw error;
                const accessToken = await this[addToken](pool);

                return await items.download({ accessToken, ...params });
            }
        },

        /**
         * @method delete
         * @description Delete item (file or folder)
         *
         * @param {String} pool - name of the pool you would like, of use
         * @param {Object} params
         * @param {String} params.itemId Item id
         *
         * @return {undefined} (204 No content)
         */
        delete: async (pool, params) => {
            try {
                const accessToken = await this[checkToken](pool);

                return await items.delete({ accessToken, ...params });
            } catch (error) {
                if (!this[isExpiredToken](error)) throw error;
                const accessToken = await this[addToken](pool);

                return await items.delete({ accessToken, ...params });
            }
        },

        /**
         * @method getByLink
         * @description get data forn ready link to one drive (ex. '@odata.nextLink')
         *
         * @param {String} pool - name of the pool you would like, of use
         * @param {Object} params
         * @param {String} params.url
         *
         * @return {Array} object of children items
         */
        getByLink: async (pool, { url }) => {
            try {
                const accessToken = await this[checkToken](pool);

                return await this[getByLink]({ accessToken, url });
            } catch (error) {
                if (!this[isExpiredToken](error)) throw error;
                const accessToken = await this[addToken](pool);

                return await this[getByLink]({ accessToken, url });
            }
        },
    };

    [getByLink] = async ({ accessToken, url }) => {
        const options = {
            method: 'GET',
            url,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            json: true,
        };

        return await request(options);
    };
}

module.exports = OneDriveUtil;
