# FlareBase

Flare Base is a comprehensive platform designed to provide easy access to key information and analytics derived from the Flare Network blockchain. It serves as a powerful tool for developers, researchers, and enthusiasts to explore and interact with blockchain data efficiently.

## Features

- **Read-only REST API**: Access essential information from the Flare Network blockchain via a user-friendly RESTful interface.
- **Aggregated and Derived Information**: Retrieve aggregated and derived data insights from the Flare Network blockchain for enhanced analytics.
- **Web Interface**: Benefit from a web interface equipped with functional tools and analytics to facilitate operations within the network.

## Technologies

- **Backend Server**: Built on Node.js with NestJS framework for robust and scalable backend functionality.
- **Persistence**: Utilizes ElasticSearch for efficient data storage and retrieval.
- **Blockchain Interaction**: Leverages EtherJS v6 for seamless interaction with the Flare Network blockchain.
- **Caching**: Implements Redis for caching mechanisms to optimize performance.
- **Frontend Framework**: Developed using Angular framework for a responsive and intuitive user interface.
- **Styling**: Enhanced with Tailwind CSS for sleek and modern aesthetics.
- **Web3 Integration**: Integrates EtherJS v6 for seamless integration with the Ethereum ecosystem.
- **Charts**: Employs Apexcharts to visualize data and insights effectively.

Flare Base empowers users with comprehensive tools and analytics to navigate and understand the Flare Network blockchain effortlessly.


## Start the appplication
To start the development server, run `npm run start`. The backend will be served at http://localhost:3000, and the frontend at http://localhost:4200.

You can also start the backend server separately using `npm run backend`

And start the frontend server separately using `npm run frontend`

## Building the application
To build the backend for production, use: `npm run build-backend`

To build the frontend for production, use: `npm run build-frontend`

## Generating Typechain Typings
To generate Typechain typings for Flare contracts, run `npm run typechain-ethers-flr`

To generate Typechain typings for Songbird contracts, run `npm run typechain-ethers-sgb`



# Configuration File `config.yml`

The `config.yml` file contains configuration settings for the Flare Base. Below are the configurable parameters and their default options.
This is the default `config.yml` file:
```yaml
serverSettings:
  port: 3000
  frontendStaticPath: "/tmp/flare-base-frontend/"
logger:
  path: "/var/log/flare-base/"
  loggerFileName: "flare-base"
  level: info
redisMembers: [localhost:6379]
network:
  - name: flare
    scanActive: false
    collectBlockchainDataIntervalSeconds: 120
    towoLabsFtsoFetchEveryMinutes: 1440
    blockchainDao:
      chainId: 14
      priceSubmitterContractAddress: "0x1000000000000000000000000000000000000003"
      rpcUrl: wss://flare-api.flare.network/ext/C/ws
      ftsoManagerWrapperPath: "./flare-ftsos-manager-wrapper.json"
      missingPriceEpochTreshold: 2
    persistenceDao:
      members: [http://localhost:6379]
      prefix: persistence
      replica: 0
      shards: 5
      persistenceMetadataCleanTimeMinutes: 60
    cacheDao:
      members: [localhost:7000]
  - name: songbird
    scanActive: false
    collectBlockchainDataIntervalSeconds: 300
    towoLabsFtsoFetchEveryMinutes: 1440
    blockchainDao:
      chainId: 19
      priceSubmitterContractAddress: "0x1000000000000000000000000000000000000003"
      rpcUrl: wss://songbird-api.flare.network/ext/bc/C/ws
      ftsoManagerWrapperPath: "./songbird-ftso-manager-wrapper.json"
      missingPriceEpochTreshold: 6
    persistenceDao:
      members: [http://localhost:9200]
      prefix: persistence
      replica: 0
      shards: 5
      persistenceMetadataCleanTimeMinutes: 60
    cacheDao:
      members: [localhost:6379]
```

## Server settings
The `serverSettings` section in the configuration file specifies settings related to server.

| Config name | Description | Default | 
| ----------- | ----------- | ----------- | 
| `serverSettings.port` | The port on which the application is served. | 3000 |
| `serverSettings.redisMembers` | This setting defines the Redis cluster members, which are essential for handling caching and other data storage functionalities within the application. The parameter accepts a list of host:port combinations representing the Redis instances in the cluster. | [localhost:6379] |
| `serverSettings.frontendStaticPath` | he static path read to serve the frontend. | /tmp/flare-base-frontend/ |

## Logger configuration
The `logger` section in the configuration file specifies settings related to logging.

| Config name | Description | Default | 
| ----------- | ----------- | ----------- | 
| `logger.path` | The directory path where log files are saved. | /var/log/flare-base/ |
| `logger.loggerFileName` | The base name for log files.	 | flare-base |
| `logger.level` | The logging level. Possible values: "debug", "info", "warn", "error".	 | info |

## Network configuration
The `network` section specifies the settings relative to the the supported Flare Networks (Flare and Songbird).

| Config name | Description | Default | 
| ----------- | ----------- | ----------- | 
| `network.name` | The network name. The value for each network should be 'flare' or 'songbird' | flare |
| `network.scanActive` | This parameter controls whether the server pre-indexes all data from the blockchain and keeps it updated over time. When this parameter is active (set to `true`), the server will pre-index all data from the blockchain and continuously update it. However, enabling this option significantly increases the startup time of the server, as it requires several hours to initialize. | true |
| `network.collectBlockchainDataIntervalSeconds` | Specifies the interval, in seconds, at which data is written from the blockchain when `scanActive` is enabled.	 | 120 |
| `network.towoLabsFtsoFetchEveryMinutes` | Specifies the frequency, in minutes, at which the list of Ftso Data Providers is updated. This list is retrieved from [https://github.com/TowoLabs/ftso-signal-providers](https://github.com/TowoLabs/ftso-signal-providers).	 | 1440 |
| `network.blockchainDao.chainId`           | ID of the blockchain. 14 for Flare, 19 for Songbird.                                                         | 14                                        |
| `network.blockchainDao.priceSubmitterContractAddress` | Address of the price submitter contract.                              | "0x1000000000000000000000000000000000000003" |
| `network.blockchainDao.rpcUrl`             | Specifies the RPC URL for interacting with the blockchain. It's recommended to use a self-hosted Flare/Songbird observer node to avoid rate limits. | wss://flare-api.flare.network/ext/C/ws  |
| `network.blockchainDao.ftsoManagerWrapperPath` | Specifies the path to the Ftso manager wrapper file. This file keeps track of any changes that have occurred or will occur on the FtsoManager contract and will be updated by the system accordingly. Remove the file and restart the server to do a new scan. | "./flare-ftsos-manager-wrapper.json"     |
| `network.blockchainDao.missingPriceEpochTreshold` | Specifies the threshold for missing price epochs. Price epochs may be missing from the blockchain due to various reasons, resulting in incomplete series of price epochs. This parameter indicates the maximum tolerance for missing price epochs. It is recommended to maintain the default values. | 2 |
| `network.persistenceDao.members`           | Specifies the list of members of the Elasticsearch nodes that will constitute the Persistence DAO layer. | [http://localhost:6379]                   |
| `network.persistenceDao.prefix`            | Specifies the index prefix. The index name will have the following structure: `${network}_${persistenceDao.prefix}_${indexName}_${timestamp}` (i.e. `flare_persistence_delegations_1708257632000`) | persistence                               |
| `network.persistenceDao.replica`           | Replica value for persistence.                                                 | 0                                         |
| `network.persistenceDao.shards`            | Number of shards for persistence.                                              | 5                                         |
| `network.persistenceDao.persistenceMetadataCleanTimeMinutes` | Time interval for persistence metadata cleanup.                   | 60                                        |
| `network.cacheDao.members`                 | This setting defines the Redis cluster members, which are essential for handling caching and other data storage functionalities within the application. The parameter accepts a list of host:port combinations representing the Redis instances in the cluster. | [localhost:7000] |

The `network.scanActive` parameter controls whether the server pre-indexes all data from the blockchain and keeps it updated over time.
### Impact

- **Active**: The server proactively indexes blockchain data, ensuring it is readily available and up-to-date. This reduces the response time for API requests but requires a longer startup time.

- **Inactive**: The server relies on on-demand API calls to fetch data from the blockchain. While this reduces startup time, complex data requests (e.g., `getVotePower`) may still require the server to fetch a large amount of data from the blockchain.


## Deploy

Follow these steps to deploy a complete instance of Flare Base (backend + frontend):

1. Build the backend by running:
```
npm run build-backend
```
2. Build the frontend by running:
```
npm run build-frontend
```

3. The generated files will be located in "dist/apps/backend" and "dist/apps/frontend".

4. Configure the `config.yml` file according to your deployment environment.

5. Copy the frontend files from "dist/apps/frontend" to a static directory specified in the `config.yml` file (e.g., `frontendStaticPath: "/tmp/flare-base-frontend/"`).

6. Launch the backend using your preferred method (e.g., nodemon, Docker, etc.).

Once deployed, the API will be accessible at `http://HOST:PORT/api` and the frontend at `http://HOST:PORT/`.

Ensure to replace `HOST` and `PORT` with your actual host and configured port respectively.

This set of instructions will enable you to deploy Flare Base with both backend and frontend components seamlessly.
