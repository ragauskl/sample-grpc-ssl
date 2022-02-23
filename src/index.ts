// gRPC error codes: https://grpc.github.io/grpc/core/md_doc_statuscodes.html
// Variable list: https://github.com/grpc/grpc/blob/master/doc/environment_variables.md
// Uncomment bellow to enable debug logging:
// process.env.GRPC_NODE_TRACE = 'all'
// process.env.GRPC_VERBOSITY = 'DEBUG'

import * as selfsigned from 'selfsigned'
import * as forge from 'node-forge'

import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
interface Data {
  message: string
}

const serverPort = 4440

const log = (prefix: string, ...args: any[]) => console.log(`[${prefix}]`, ...args)
const error = (prefix: string, ...args: any[]) => console.error(`[${prefix}]`, ...args)


const packageDefinition = protoLoader.loadSync(
  `${__dirname}/proto/core.proto`, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  }
)
const { core: { Core: CoreDef } } = grpc.loadPackageDefinition(packageDefinition) as {
  core: {
    Core: any & {
      service: any
    }
  }
}

const ssl: {
  private: string
  cert: string
} = selfsigned.generate([{
  name: 'commonName',
  value: 'localhost'
}, {
  name: 'countryName',
  value: 'UK'
}, {
  name: 'organizationName',
  value: 'Organization'
}, {
  name: 'organizationalUnitName',
  value: 'Organization Sector'
}, {
  name: 'emailAddress',
  value: 'example@gmail.com'
}], {
  // List of all options: https://www.npmjs.com/package/selfsigned
  extensions: [
    // List of extensions @ https://github.com/digitalbazaar/forge/blob/main/lib/x509.js#L1515
    { name: 'basicConstraints', cA: true },
    {
      name: 'keyUsage',
      keyCertSign: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true
    },
    
    {
      // Alt name types @ https://github.com/digitalbazaar/forge/blob/main/lib/x509.js#L1453
      // https://github.com/digitalbazaar/forge/blob/main/lib/oids.js
      // https://www.entrust.com/blog/2019/03/what-is-a-san-and-how-is-it-used/
      name: 'subjectAltName',
      altNames: [{
        type: 2,
        value: 'localhost'
      }, {
        type: 7,
        value: forge.util.bytesFromIPv4('127.0.0.1')
      }, {
        type: 7,
        value: forge.util.bytesFromIPv4('0.0.0.0')
      }]
    }
  ]
})


let destroy: undefined | (() => void)

function exit () {
  console.log('Exiting...')
  if (destroy) {
    destroy()
    setTimeout(() => process.exit(0), 500)
  }
}
process.on('SIGINT', () => exit())

async function startServer () {
  log('server', `starting gRPC server`)
  const cred = grpc.ServerCredentials.createSsl(Buffer.from(ssl.cert), [{
    cert_chain: Buffer.from(ssl.cert),
    private_key: Buffer.from(ssl.private)
  }])

  const grpcServer = new grpc.Server()
  const clientImpl: {
    send: grpc.handleUnaryCall<Data, Data>
  } = {
    send: (call, cb) => {
      const { message } = call.request as any
      log('server', `Received: ${message}`)
      cb(null, { message: `Reply for ${message}` } as any)
    }
  }
  destroy = () => grpcServer.tryShutdown(e => e && error('server', 'Shutdown error: ', e))
  
 try {
  grpcServer.addService(
    CoreDef.service, clientImpl
  )

  const serverUrl = `ipv4:0.0.0.0:${serverPort}`
  await new Promise<void>((res, rej) => {
    grpcServer.bindAsync(
      `${serverUrl}`,
      cred,
      err => {
        if (err) {
          return rej(new Error(`Failed to bind grpc server: ${err.message}`))
        }
        grpcServer.start()
        log('server', `gRPC listening on ${serverUrl}`)
        res()
      }
    )
  })
 } catch (e) {
   error('server', e)
 }
}

async function connectToServer () {
  const cred = grpc.credentials.createSsl(Buffer.from(ssl.cert))

  const serverUrl = `ipv4:${'127.0.0.1'}:${serverPort}`
  log('client', `Attempting connection to ${serverUrl}`)
  try {
    const client = new CoreDef(
      serverUrl,
      cred, {
        // Max wait time should be less that client.waitForReady
        'grpc.max_reconnect_backoff_ms': 3_000
      }
    )

    let interval: NodeJS.Timer | undefined

    destroy = () => {
      clearInterval(interval)
      client.close()
    }
  
    await new Promise<void>((res, rej) => {
      client.waitForReady(new Date(new Date().getTime() + 5_000), (e) => {
        if (e) return rej(e)
        res()
      })
    })
    log('client', `Connected to server`)

    let i = 0
    const send = async () => {
      i++
      log('client', `Sending ${i}`)
      try {
        await new Promise((res, rej) => {
          const str = client.send({ message: `Message No. ${i}` }, (e: Error) => {
            if (e) return rej(e)
            res(str)
          })
        })
      } catch (e) {
        error('client', `Failed to send message to server: `, e)
      }
    }
    interval = setInterval(send, 2_000)
  } catch (e) {
    error('client', `Failed to connect to server: `, e)
    exit()
  }
}

startServer().then(() => connectToServer())





