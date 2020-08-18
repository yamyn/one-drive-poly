const { items } = require('onedrive-api');
const request = require('request-promise');
const path = require('path');

class ApiService {
    userPathGenerator = (params) => {
        if (params.shared && !params.user) {
            throw new Error("params.shared is set but params.user is missing");
        }

        return params.shared ? 'users/' + params.user + '/' : 'me/';
    }
    listChildren = (params) => {
        params.itemId = params.itemId === undefined ? "root" : params.itemId;
        var userPath = this.userPathGenerator(params);

        var options = {
            method: 'GET',
            uri: appConfig.apiUrl + userPath + 'drive/items/' + params.itemId + '/children',
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + params.accessToken
            },
            json: true
        };

        return request(options);
    }

    createFolder = (params) => {
        if (!params.name) {
            throw new Error("Missing params.name");
        }

        params.rootItemId = params.rootItemId === undefined ? "root" : params.rootItemId;
        var userPath = userPathGenerator(params);

        var options = {
            method: 'POST',
            uri: appConfig.apiUrl + userPath + 'drive/items/' + params.rootItemId + '/children',
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + params.accessToken
            },
            body: {
                name: params.name,
                folder: {}
            },
            json: true
        };

        return request(options);

    }

    uploadSimple = (params) => {
        if (!params.filename) {
            throw new Error("Missing params.filename");
        }

        if (!params.readableStream) {
            throw new Error("Missing params.readableStream");
        }

        return new Promise(function (resolve, reject) {

            params.parentId = params.parentId === undefined ? "root" : params.parentId;
            var userPath = userPathGenerator(params);

            var uri = appConfig.apiUrl + userPath + 'drive/items/' + params.parentId + "/children/" + params.filename + "/content";

            if (params.parentPath !== undefined && typeof (params.parentPath) === 'string')
                uri = appConfig.apiUrl + userPath + 'drive/root:/' + path.join(params.parentPath, params.filename) + ":/content";

            var options = {
                method: 'PUT',
                uri: uri,
                headers: {
                    Authorization: "Bearer " + params.accessToken
                },
                json: true
            };

            params.readableStream.pipe(request(options, function (err, res, body) {
                if (err)
                    return reject(err);
                else if (res.statusCode >= 400)
                    return reject(body);
                resolve(body);

            }));
        });

    }
    uploadSession = (params) => {
        if (!params.accessToken) {
            throw new Error("Missing params.accessToken");
        }

        if (!params.filename) {
            throw new Error("Missing params.filename");
        }

        if (!params.readableStream) {
            throw new Error("Missing params.readableStream");
        }

        if (!params.fileSize) {
            throw new Error("Missing params.fileSize");
        }

        return new Promise(function (resolve, reject) {
            params.parentId = params.parentId === undefined ? 'root' : params.parentId;
            var userPath = userPathGenerator(params);

            params.chunksToUpload = params.chunksToUpload === undefined ? 20 : params.chunksToUpload;

            var uri
            if (params.parentPath !== undefined && typeof params.parentPath === "string") {
                uri = appConfig.apiUrl + userPath + 'drive/root:/' + path.join(params.parentPath, params.filename) + ':/createUploadSession';
            } else if (params.parentId) {
                uri = appConfig.apiUrl + userPath + 'drive/items/' + params.parentId + ':/' + params.filename + ':/createUploadSession';
            } else {
                params.parentId = "root";
                uri = appConfig.apiUrl + userPath + 'drive/' + params.parentId + ':/' + params.filename + ':/createUploadSession';
            }
            // total uploaded bytes
            var uploadedBytes = 0;
            // size of the chunks that are going to be uploaded
            var chunksToUploadSize = 0;
            // chunks we've accumulated in memory that we're going to upload
            var chunks = [];

            var urlResponse;

            request({
                method: "POST",
                uri,
                headers: {
                    Authorization: 'Bearer ' + params.accessToken
                },
                body: {
                    "@microsoft.graph.conflictBehavior": "rename",
                    fileSystemInfo: { "@odata.type": "microsoft.graph.fileSystemInfo" },
                    name: params.filename
                },
                resolveWithFullResponse: true,
                json: true
            }).then(function (_urlResponse) {
                urlResponse = _urlResponse
                if (urlResponse.statusCode >= 400) {
                    return reject(urlResponse.body);
                }
                params.readableStream.on("data", function (chunk) {
                    chunks.push(chunk);
                    chunksToUploadSize += chunk.length;

                    // upload only if we've specified number of chunks in memory OR we're uploading the final chunk
                    if (chunks.length === params.chunksToUpload || chunksToUploadSize + uploadedBytes === params.fileSize) {
                        params.readableStream.pause();
                        // make buffer from the chunks
                        var payload = Buffer.concat(chunks, chunksToUploadSize);
                        var uploadResponse
                        request({
                            method: "PUT",
                            uri: urlResponse.body.uploadUrl,
                            headers: {
                                "Content-Length": chunksToUploadSize,
                                "Content-Range": 'bytes ' + uploadedBytes + '-' + (uploadedBytes + chunksToUploadSize - 1) + '/' + params.fileSize
                            },
                            body: payload,
                            resolveWithFullResponse: true
                        }).then(function (_uploadResponse) {
                            uploadResponse = _uploadResponse
                            if (uploadResponse.statusCode >= 400) {
                                return reject(uploadResponse.body);
                            }

                            // update uploaded bytes
                            uploadedBytes += chunksToUploadSize;
                            /* TODO: 
                            ** emit an event here, that emits the value of uploadedBytes,
                            ** this can be listened to by the caller to check the current upload progress 
                            */

                            // reset for next chunks
                            chunks = [];
                            chunksToUploadSize = 0;

                            if (
                                uploadResponse.statusCode === 201 ||
                                uploadResponse.statusCode === 203 ||
                                uploadResponse.statusCode === 200
                            ) {
                                resolve(JSON.parse(uploadResponse.body));
                            }
                            params.readableStream.resume();
                        }).catch(reject)
                    }
                });
            }).catch(reject)
        });
    }
}

module.exports = new ApiService();