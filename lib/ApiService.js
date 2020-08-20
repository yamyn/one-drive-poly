const axios = require('axios');
const qs = require('querystring');
const path = require('path');
const isEmpty = require('lodash.isempty');

class ApiService {
    constructor() {
        this.apiUrl = 'https://graph.microsoft.com/v1.0/';
        this.authPath =
            'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    }
    userPathGenerator = params => {
        if (params.shared && !params.user) {
            throw new Error('params.shared is set but params.user is missing');
        }

        return params.shared ? 'users/' + params.user + '/' : 'me/';
    };

    getAccessToken = ({
        client_id,
        client_secret,
        redirect_uri,
        refresh_token,
    }) => {
        const body = {
            client_id,
            client_secret,
            redirect_uri,
            refresh_token,
            grant_type: 'refresh_token',
        };

        const reqConfig = {
            method: 'POST',
            url: this.authPath,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            data: qs.stringify(body),
        };

        return axios(reqConfig);
    };

    listChildren = params => {
        params.itemId = params.itemId === undefined ? 'root' : params.itemId;
        var userPath = this.userPathGenerator(params);

        var reqConfig = {
            method: 'GET',
            url:
                this.apiUrl +
                userPath +
                'drive/items/' +
                params.itemId +
                '/children',
            headers: {
                'Content-Type': 'application/json',
                Authorization: params.auth,
            },
        };

        return axios(reqConfig);
    };

    // createFolder = params => {
    //     if (!params.name) {
    //         throw new Error('Missing params.name');
    //     }

    //     params.rootItemId =
    //         params.rootItemId === undefined ? 'root' : params.rootItemId;
    //     var userPath = this.userPathGenerator(params);

    //     var options = {
    //         method: 'POST',
    //         uri:
    //             this.apiUrl +
    //             userPath +
    //             'drive/items/' +
    //             params.rootItemId +
    //             '/children',
    //         headers: {
    //             'Content-Type': 'application/json',
    //             Authorization: 'Bearer ' + params.accessToken,
    //         },
    //         body: {
    //             name: params.name,
    //             folder: {},
    //         },
    //         json: true,
    //     };

    //     return request(options);
    // };

    // uploadSimple = params => {
    //     if (!params.filename) {
    //         throw new Error('Missing params.filename');
    //     }

    //     if (!params.readableStream) {
    //         throw new Error('Missing params.readableStream');
    //     }

    //     return new Promise((resolve, reject) => {
    //         params.parentId =
    //             params.parentId === undefined ? 'root' : params.parentId;
    //         var userPath = this.userPathGenerator(params);

    //         var uri =
    //             this.apiUrl +
    //             userPath +
    //             'drive/items/' +
    //             params.parentId +
    //             '/children/' +
    //             params.filename +
    //             '/content';

    //         if (
    //             params.parentPath !== undefined &&
    //             typeof params.parentPath === 'string'
    //         )
    //             uri =
    //                 this.apiUrl +
    //                 userPath +
    //                 'drive/root:/' +
    //                 path.join(params.parentPath, params.filename) +
    //                 ':/content';

    //         var options = {
    //             method: 'PUT',
    //             uri: uri,
    //             headers: {
    //                 Authorization: 'Bearer ' + params.accessToken,
    //             },
    //             json: true,
    //         };

    //         params.readableStream.pipe(
    //             request(options, (err, res, body) => {
    //                 if (err) return reject(err);
    //                 else if (res.statusCode >= 400) return reject(body);
    //                 resolve(body);
    //             }),
    //         );
    //     });
    // };

    // uploadSession = params => {
    //     if (!params.filename) {
    //         throw new Error('Missing params.filename');
    //     }

    //     if (!params.readableStream) {
    //         throw new Error('Missing params.readableStream');
    //     }

    //     if (!params.fileSize) {
    //         throw new Error('Missing params.fileSize');
    //     }

    //     return new Promise((resolve, reject) => {
    //         params.parentId =
    //             params.parentId === undefined ? 'root' : params.parentId;
    //         var userPath = this.userPathGenerator(params);

    //         params.chunksToUpload =
    //             params.chunksToUpload === undefined
    //                 ? 20
    //                 : params.chunksToUpload;

    //         var uri;
    //         if (
    //             params.parentPath !== undefined &&
    //             typeof params.parentPath === 'string'
    //         ) {
    //             uri =
    //                 this.apiUrl +
    //                 userPath +
    //                 'drive/root:/' +
    //                 path.join(params.parentPath, params.filename) +
    //                 ':/createUploadSession';
    //         } else if (params.parentId) {
    //             uri =
    //                 this.apiUrl +
    //                 userPath +
    //                 'drive/items/' +
    //                 params.parentId +
    //                 ':/' +
    //                 params.filename +
    //                 ':/createUploadSession';
    //         } else {
    //             params.parentId = 'root';
    //             uri =
    //                 this.apiUrl +
    //                 userPath +
    //                 'drive/' +
    //                 params.parentId +
    //                 ':/' +
    //                 params.filename +
    //                 ':/createUploadSession';
    //         }
    //         // total uploaded bytes
    //         var uploadedBytes = 0;
    //         // size of the chunks that are going to be uploaded
    //         var chunksToUploadSize = 0;
    //         // chunks we've accumulated in memory that we're going to upload
    //         var chunks = [];

    //         var urlResponse;

    //         request({
    //             method: 'POST',
    //             uri,
    //             headers: {
    //                 Authorization: 'Bearer ' + params.accessToken,
    //             },
    //             body: {
    //                 '@microsoft.graph.conflictBehavior': 'rename',
    //                 fileSystemInfo: {
    //                     '@odata.type': 'microsoft.graph.fileSystemInfo',
    //                 },
    //                 name: params.filename,
    //             },
    //             resolveWithFullResponse: true,
    //             json: true,
    //         })
    //             .then(function (_urlResponse) {
    //                 urlResponse = _urlResponse;
    //                 if (urlResponse.statusCode >= 400) {
    //                     return reject(urlResponse.body);
    //                 }
    //                 params.readableStream.on('data', function (chunk) {
    //                     chunks.push(chunk);
    //                     chunksToUploadSize += chunk.length;

    //                     // upload only if we've specified number of chunks in memory OR we're uploading the final chunk
    //                     if (
    //                         chunks.length === params.chunksToUpload ||
    //                         chunksToUploadSize + uploadedBytes ===
    //                             params.fileSize
    //                     ) {
    //                         params.readableStream.pause();
    //                         // make buffer from the chunks
    //                         var payload = Buffer.concat(
    //                             chunks,
    //                             chunksToUploadSize,
    //                         );
    //                         var uploadResponse;
    //                         request({
    //                             method: 'PUT',
    //                             uri: urlResponse.body.uploadUrl,
    //                             headers: {
    //                                 'Content-Length': chunksToUploadSize,
    //                                 'Content-Range':
    //                                     'bytes ' +
    //                                     uploadedBytes +
    //                                     '-' +
    //                                     (uploadedBytes +
    //                                         chunksToUploadSize -
    //                                         1) +
    //                                     '/' +
    //                                     params.fileSize,
    //                             },
    //                             body: payload,
    //                             resolveWithFullResponse: true,
    //                         })
    //                             .then(function (_uploadResponse) {
    //                                 uploadResponse = _uploadResponse;
    //                                 if (uploadResponse.statusCode >= 400) {
    //                                     return reject(uploadResponse.body);
    //                                 }

    //                                 // update uploaded bytes
    //                                 uploadedBytes += chunksToUploadSize;
    //                                 /* TODO:
    //                                  ** emit an event here, that emits the value of uploadedBytes,
    //                                  ** this can be listened to by the caller to check the current upload progress
    //                                  */

    //                                 // reset for next chunks
    //                                 chunks = [];
    //                                 chunksToUploadSize = 0;

    //                                 if (
    //                                     uploadResponse.statusCode === 201 ||
    //                                     uploadResponse.statusCode === 203 ||
    //                                     uploadResponse.statusCode === 200
    //                                 ) {
    //                                     resolve(
    //                                         JSON.parse(uploadResponse.body),
    //                                     );
    //                                 }
    //                                 params.readableStream.resume();
    //                             })
    //                             .catch(reject);
    //                     }
    //                 });
    //             })
    //             .catch(reject);
    //     });
    // };

    // update = params => {
    //     if (!params.itemId) {
    //         throw new Error('Missing params.itemId');
    //     }

    //     if (!params.toUpdate || isEmpty(params.toUpdate)) {
    //         throw new Error('params.toUpdate should not be empty');
    //     }

    //     var userPath = this.userPathGenerator(params);

    //     var options = {
    //         method: 'PATCH',
    //         uri: this.apiUrl + userPath + 'drive/items/' + params.itemId,
    //         headers: {
    //             'Content-Type': 'application/json',
    //             Authorization: 'Bearer ' + params.accessToken,
    //         },
    //         body: params.toUpdate,
    //         json: true,
    //     };

    //     return request(options);
    // };

    // getMetadata = params => {
    //     if (!params.itemId) {
    //         throw new Error('Missing params.itemId');
    //     }

    //     var userPath = this.userPathGenerator(params);

    //     var options = {
    //         method: 'GET',
    //         uri: this.apiUrl + userPath + 'drive/items/' + params.itemId,
    //         headers: {
    //             'Content-Type': 'application/json',
    //             Authorization: 'Bearer ' + params.accessToken,
    //         },
    //         json: true,
    //     };

    //     return request(options);
    // };

    // download = params => {
    //     if (!params.itemId) {
    //         throw new Error('Missing params.itemId');
    //     }

    //     var userPath = this.userPathGenerator(params);

    //     var options = {
    //         method: 'GET',
    //         uri:
    //             this.apiUrl +
    //             userPath +
    //             'drive/items/' +
    //             params.itemId +
    //             '/content',
    //         headers: {
    //             Authorization: 'Bearer ' + params.accessToken,
    //         },
    //     };

    //     return request(options);
    // };

    // delete = params => {
    //     if (!params.itemId) {
    //         throw new Error('Missing params.itemId');
    //     }

    //     var userPath = this.userPathGenerator(params);

    //     var options = {
    //         method: 'DELETE',
    //         uri: this.apiUrl + userPath + 'drive/items/' + params.itemId,
    //         headers: {
    //             'Content-Type': 'application/json',
    //             Authorization: 'Bearer ' + params.accessToken,
    //         },
    //         json: true,
    //     };

    //     return request(options);
    // };

    // getByLink = ({ accessToken, url }) => {
    //     const options = {
    //         method: 'GET',
    //         url,
    //         headers: {
    //             'Content-Type': 'application/json',
    //             Authorization: `Bearer ${accessToken}`,
    //         },
    //         json: true,
    //     };

    //     return request(options);
    // };
}

module.exports = new ApiService();
