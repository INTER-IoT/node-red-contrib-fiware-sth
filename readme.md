The node fiware-sth provides information from FIWARE Short Time Historic (STH) - Comet.

# Installation

Requirements:

- node-red
- docker

1- Install and run Orion, STH and mongodb with:

```sh
cd StackSTH
docker-compose up
```

2.1- Copy folder `Fiware-sth` in the node_modules directory (Windows `C:\Users\%username%\.node-red\node_modules` or linux `~/.node-red/node_modules`) and install the dependencies:

```sh
cp ./Fiware-sth PATH/TO/NODE_MODULES
```

```sh
... node_modules directory ...
cd Fiware-sth
npm install
```

2.2- Run or restart `node-red` server

# Usage

Add an atribute "entityID" with the id of entity to search

# Example

**Input data**

```json
{
    ...
  "entityID":"sala1"
    ...
}
```

**Output data**

```json
{
  "contextResponses": [
    {
      "contextElement": {
        "attributes": [
          {
            "name": "temperatura",
            "values": [
              {
                "recvTime": "2017-03-20T13:55:06.492Z",
                "attrType": "Number",
                "attrValue": 14.3
              }
            ]
          }
        ],
        "id": "sala1",
        "isPattern": false,
        "type": "Sala"
      },
      "statusCode": {
        "code": "200",
        "reasonPhrase": "OK"
      }
    }
  ]
}
```

# Todos

- Make a node for aggregated time series context information
- Improve refresh token system
- Make login easier
- Run tests

# License

ASL 2.0 license
