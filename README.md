# Description

Small TypeScript example for using gRPC with SSL in Node.js. For sake of simplicity self-signed certificates are used. Needles to say this is not code/example to be used for production, it's for playing around with gRPC locally.

# Instructions

* npm i
* npm init
* npm start

# Notes

### gRPC types

Not working perfectly with [@grpc/grpc-js](https://www.npmjs.com/package/@grpc/grpc-js), therefore usage is skipped, but script 'npm run proto:types' is available. At the time used [grpc-tools](https://www.npmjs.com/package/grpc-tools) seem to still use [old grpc for Node.js](https://www.npmjs.com/package/grpc)

