/**
 * INTER-IoT. Interoperability of IoT Platforms.
 * INTER-IoT is a R&D project which has received funding from the European
 * Union’s Horizon 2020 research and innovation programme under grant
 * agreement No 687283.
 *
 * Copyright (C) 2016-2018, by (Author's company of this file):
 * - Prodevelop S.L.
 *
 *
 * For more information, contact:
 * - @author <a href="mailto:jmartinez@prodevelop.es">Julian Martinez</a>
 * - Project coordinator:  <a href="mailto:coordinator@inter-iot.eu"></a>
 *
 *
 *    This code is licensed under the ASL 2.0 license, available at the root
 *    application directory.
 */

module.exports = function(RED) {
    "use strict";

    var http = require("follow-redirects").http;
    var https = require("follow-redirects").https;
    var urllib = require("url");
    var when = require('when');

    function getOauth(appPublic, appSecret, authServer, pathAuth, pathToken) {
        var credentials = {
            client: {
                id: appPublic,
                secret: appSecret
            },
            auth: {
                tokenHost: authServer,
                authorizePath: pathAuth,
                tokenPath: pathToken
            }
        };
        return require('simple-oauth2').create(credentials);
    }

    function getOauthNodeId(nodeId) {
        var configNode = RED.nodes.getNode(nodeId);
        var credentials = configNode.credentials
        var myAppPublic = credentials.appId;
        var myAppSecret = credentials.appSecret;
        var myAuthServer = configNode.authServerUri;
        var myPathAuth = configNode.authorizePath;
        var myPathToken = configNode.tokenPath;
        return getOauth(myAppPublic, myAppSecret, myAuthServer, myPathAuth, myPathToken);
    }

    function refreshToken(nodeId) {

        var oauth2 = getOauthNodeId(nodeId);
        //Get Credentials of the server node
        var credentials = RED.nodes.getCredentials(nodeId);
        var myId = credentials.appId;
        var mySecret = credentials.appSecret;

        var token = oauth2.accessToken.create(credentials.oauth_token.token);


        token.refresh(function(error, result) {
            credentials = {};
            credentials.appId = myId;
            credentials.appSecret = mySecret;
            credentials.oauth_token = result;
            credentials.access_token = credentials.oauth_token.token.access_token;
            RED.nodes.addCredentials(nodeId, credentials);
        });
    }



    function getCompleteUrl(n) {
        var url = n.url;
        if (!(url.includes("https") || url.includes("http"))) {
            url = "http://" + url + ":" + n.port;
        }
        return url;
    }

    function encodeQueryData(data) {
        let ret = [];
        for (let d in data)
            ret.push(encodeURIComponent(d) + '=' + encodeURIComponent(data[d]));
        return ret.join('&');
    }


    function FiwareSthService(n) {
        RED.nodes.createNode(this, n);

        this.url = n.url;
        this.port = n.port;
        this.authServerUri = n.authServerUri;
        this.authorizePath = n.authorizePath;
        this.tokenPath = n.tokenPath;
        var sthUrl = getCompleteUrl(n);
        if (/\/$/.test(this.url)) {
            this.url = this.url.substring(this.url.length - 1);
        }
        var err = "";

        if (!this.port) {
            err = "Missing port";
        }

        if (err) {
            throw err;
        }


        this.querySth = (node, n, msg) => {
            node.status({
                fill: "blue",
                shape: "dot",
                text: "Petición en curso"
            });


            var credentials = RED.nodes.getCredentials(node.service);

            var access_token = credentials.access_token;

            var myId = msg.entityID;
            var myType = n.entype;
            var myAttr = n.attr;
            var myFiServer = n.fiwareServer;
            var myFiPath = n.fiwarePath;
            var myLastN = n.lastN;

            var myQuery = encodeQueryData({
                "lastN": myLastN
            });

            if (n.period != 0) {
                myQuery += "&" + encodeQueryData({
                    "dateFrom": new Date().getTime() - n.period,
                });
            }

            return when.promise(function(resolve, reject) {
                var url = sthUrl + "/STH/v1/contextEntities/type/" + myType + "/id/" + myId + "/attributes/" + myAttr + "?" + myQuery;
                var opts = urllib.parse(url);
                opts.method = "GET";
                opts.headers = {};
                opts.headers['content-type'] = "application/json";
                opts.headers["Accept"] = "application/json";
                opts.headers["Fiware-Service"] = myFiServer;
                opts.headers["Fiware-ServicePath"] = myFiPath;
                if (access_token) {
                    opts.headers["X-Auth-Token"] = access_token;
                }

                var msg = {};

                var typeHttp;
                if (url.includes("https")) {
                    typeHttp = https;
                } else {
                    typeHttp = http;
                }

                var req = typeHttp.request(opts, function(res) {
                    (node.ret === "bin") ? res.setEncoding('binary'): res.setEncoding('utf8');
                    msg.statusCode = res.statusCode;
                    msg.payload = "";
                    res.on('data', function(input) {
                        msg.payload += input;
                    });
                    res.on('end', function() {
                        if (res.statusCode == 200) {
                            node.status({});
                            resolve(msg);
                        } else {
                            reject(msg);
                            node.status({
                                fill: "red",
                                shape: "ring",
                                text: "Request error code: " + res.statusCode
                            });
                        }
                    });
                });
                req.on('error', function(err) {
                    reject(err);
                    node.status({
                        fill: "red",
                        shape: "ring",
                        text: err.code
                    });
                });
                req.end();
            });
        }
    }

    function FiwareSth(n) {
        RED.nodes.createNode(this, n);
        this.on('input', function(msg) {
            this.service = n.service;
            this.conex = RED.nodes.getNode(this.service);
            var node = this;
            try {
                var token = RED.nodes.getNode(this.service).credentials.oauth_token;

                if (token && new Date(token.token.expires_at).getTime >= (new Date().getTime() - 180000)) {
                  refreshToken(this.service);
                }
                node.conex.querySth(node, n, msg).then(
                    function(msg) {
                        node.send(msg);
                    },
                    function(error) {
                        node.error("Error: " + JSON.stringify(error));
                    }
                );
            } catch (err) {
                node.error(err, msg);
                node.send({
                    payload: err.toString(),
                    statusCode: err.code
                });
            }
        });
    }
    RED.nodes.registerType("fiware-sth-raw", FiwareSth);

    RED.nodes.registerType("fiware-sth-service", FiwareSthService, {
        credentials: {
            access_token: {
                type: "password"
            },
            oauth_token: {
                type: "password"
            },
            appId: {
                type: "password"
            },
            appSecret: {
                type: "password"
            },
        }
    });

    RED.httpAdmin.get('/sthServer/login/auth', function(req, res, next) {

        try {
            var oauth2 = getOauthNodeId(req.query.state);
            var urlNew = oauth2.authorizationCode.authorizeURL({
                redirect_uri: req.query.callback,
                state: req.query.state
            });
            res.redirect(urlNew);
        } catch (e) {
            RED.log.log("Error: " + e);
            res.sendStatus(500);
            // res.send(500,e);
        }

    });


    RED.httpAdmin.get('/sthServer/login/callback', function(req, res, next) {

        //Get callback url
        var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
        var urlSub = fullUrl.substr(0, fullUrl.indexOf('?'));

        //Get Credentials of the server node
        var credentials = RED.nodes.getCredentials(req.query.state);
        var myId = credentials.appId;
        var mySecret = credentials.appSecret;
        // Create config for request token
        var tokenConfig = {
            code: req.query.code,
            redirect_uri: urlSub
        };
        try {
            var oauth2 = getOauthNodeId(req.query.state);

            oauth2.authorizationCode.getToken(tokenConfig, function(error, result) {
                if (error) {
                    RED.log.error("Token error: " + error);
                    res.send(RED._("<html><head></head><body><p>Something went wrong with the authentication process</p></body></html>"));
                } else {
                    credentials = {};
                    credentials.appId = myId;
                    credentials.appSecret = mySecret;
                    credentials.oauth_token = oauth2.accessToken.create(result);
                    credentials.access_token = credentials.oauth_token.token.access_token;
                    RED.nodes.addCredentials(req.query.state, credentials);
                    res.send(RED._("<html><head></head><body><p>Authorised - you can close this window and return to Node-RED</p></body></html>"));
                }
            });
        } catch (e) {
            RED.log.log("Error: " + e);
            res.sendStatus(500);
            // res.send(500,e);
        }
    });

}
