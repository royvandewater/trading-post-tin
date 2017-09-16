const request = require('request')

class Tin {
  constructor() {
    this.request = request.defaults({
      baseUrl: 'http://stock.octoblu.com/',
      json: true,
    })
  }

  decide({ ticker }, callback) {
    this.request.get(`/stocks/${ticker}`, (error, response) => {
      if (error) return callback(error)
      if (response.statusCode !== 200) return callback(new Error(`Unexpected response status code. Expected 200, received: ${response.statusCode}`))

      const { previousClose, lastTradePriceOnly } = response.body
      return callback(null, {
        quantity: parseInt(previousClose - lastTradePriceOnly, 10),
      })
    })
  }
}

module.exports = Tin
