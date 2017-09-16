#!/usr/bin/env node

/* eslint-disable no-console */

const chalk = require('chalk')
const debug = require('debug')('tin')
const dashdash = require('dashdash')
const fs = require('fs')
const camelCase = require('lodash/fp/camelCase')
const find = require('lodash/fp/find')
const getOr = require('lodash/fp/getOr')
const isEmpty = require('lodash/fp/isEmpty')
const mapKeys = require('lodash/fp/mapKeys')
const min = require('lodash/fp/min')
const TradingPost = require('trading-post')

const packageJson = require('./package.json')
const Tin = require('./src/Tin')

const parser = dashdash.createParser({
  options: [{
    names: ['base-url', 'b'],
    type: 'string',
    help: 'URL where the trading-post API can be found',
    default: 'https://trading-post.club',
  }, {
    names: ['credentials-file', 'c'],
    type: 'string',
    help: '[Required] Must be a JSON file and contain a refresh_token. access_token will automatically be retrieved and cached here.',
    default: './credentials.json',
  }, {
    names: ['help', 'h'],
    type: 'bool',
    help: 'Print this help and exit.',
  }, {
    names: ['version', 'v'],
    type: 'bool',
    help: 'Print the current version and exit.',
  }],
})

class Command {
  constructor({ argv }) {
    this.options = mapKeys(camelCase, parser.parse(argv))
  }

  run() {
    const {
      args, baseUrl, credentialsFile, help, version,
    } = this.options

    if (help) {
      console.log(this.usage())
      process.exit(0)
    }

    if (version) {
      console.log(packageJson.version)
      process.exit(0)
    }

    const [ticker] = args

    if (isEmpty(ticker)) {
      console.error(this.usage())
      console.error(chalk.red('\nMissing a <ticker>'))
      process.exit(1)
    }

    this.validateCredentialsFile(credentialsFile)


    this.getCurrentQuantity({ baseUrl, credentialsFile, ticker }, (error, currentQuantity) => {
      if (error) throw error

      this.tinit({ baseUrl, credentialsFile, currentQuantity, ticker }, (error, result) => {
        if (error) throw error
        console.log(JSON.stringify(result, null, 2))
      })
    })
  }

  getCurrentQuantity({ baseUrl, credentialsFile, ticker }, callback) {
    const tradingPost = new TradingPost({ baseUrl, credentialsFile })
    tradingPost.getUser((error, user) => {
      if (error) return callback(error)

      const stock = find({ ticker }, user.stocks)
      callback(null, getOr(0, 'quantity', stock))
    })
  }

  tinit({ baseUrl, credentialsFile, currentQuantity, ticker }, callback) {
    const tradingPost = new TradingPost({ baseUrl, credentialsFile })
    const tin = new Tin()
    tin.decide({ ticker }, (error, { quantity } = {}) => {
      if (error) return callback(error)
      debug('I have:', currentQuantity, 'tin says buy:', quantity)
      if (quantity > 0) return tradingPost.createBuyOrder({ quantity, ticker }, (error, buyOrder) => callback(error, { buyOrder }))
      if (currentQuantity === 0 || quantity === 0) return callback(null, { noAction: {} })

      const order = {
        quantity: min(currentQuantity, Math.abs(quantity)),
        ticker,
      }
      return tradingPost.createSellOrder(order, (error, sellOrder) => callback(error, { sellOrder }))
    })
  }

  usage() {
    return `
USAGE:
    ${packageJson.name} [OPTIONS] <ticker>

OPTIONS:
${parser.help({ includeEnv: true, indent: 4 })}
    `.trim()
  }

  validateCredentialsFile(credentialsFile) {
    if (isEmpty(credentialsFile)) {
      console.error(this.usage())
      console.error(chalk.red('Missing required global option --credentials-file, -c'))
      process.exit(1)
    }

    let credentialsStr
    try {
      credentialsStr = fs.readFileSync(credentialsFile, 'utf8')
    } catch (error) {
      console.error(this.usage())
      console.error(chalk.red(`Could not access file at "${credentialsFile}": \n${error.stack}`))
      process.exit(1)
    }

    let credentials
    try {
      credentials = JSON.parse(credentialsStr)
    } catch (error) {
      console.error(this.usage())
      console.error(chalk.red(`Could not parse JSON in "${credentialsFile}": \n${error.stack}`))
      process.exit(1)
    }

    if (isEmpty(credentials.refresh_token)) {
      console.error(this.usage())
      console.error(chalk.red(`File at "${credentialsFile}" is missing the key "refresh_token"`))
      process.exit(1)
    }
  }
}

module.exports = Command
if (!module.parent) {
  const command = new Command({ argv: process.argv })
  command.run()
}
