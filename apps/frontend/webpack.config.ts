const path = require('path')
const webpack = require('webpack');

export default function customConfig(config) {
    return {
        ...config,
        plugins: [
            ...config.plugins,
            new webpack.DefinePlugin({
                "process.env": {
                    // This has effect on the react lib size
                    NODE_ENV: JSON.stringify("development"),
                  }
            }),
        ],
        resolve: {
            ...config.resolve,
            alias: {
                ...config.resolve.alias,
                // shims out nestjs swagger module in the frontend for DTO sharing
                '@nestjs/swagger': path.resolve(__dirname, '../../node_modules/@nestjs/swagger/dist/extra/swagger-shim'),
                "stream": require.resolve("stream-browserify")

            }
        }
    };
}