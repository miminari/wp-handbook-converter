#!/usr/bin/env node

'use strict'

const fs = require('fs')
const program = require('commander')
const mkdirp = require('mkdirp')
const _ = require('lodash')
const WPAPI = require('wpapi')

mkdirp('en/', err => {
  if (err) console.log(err)
})

const getAll = request => {
  return request.then(response => {
    if (!response._paging || !response._paging.next) {
      return response
    }
    // Request the next page and return both responses as one collection
    return Promise.all([response, getAll(response._paging.next)]).then(
      responses => _.flatten(responses)
    )
  })
}

const generateJson = async (team, handbook, subdomain, outputDir) => {
  handbook = handbook ? handbook : 'handbook'
  subdomain = `${
    subdomain ? (subdomain === 'w.org' ? '' : subdomain) : 'make'
  }.`
  outputDir = outputDir ? outputDir.replace(/\/$/, '') + '/' : 'en/'

  const wp = new WPAPI({
    endpoint: `https://${subdomain}wordpress.org/${team}/wp-json`
  })
  wp.handbooks = wp.registerRoute('wp/v2', `/${handbook}/(?P<id>)`)

  console.log(
    `Connecting to https://${subdomain}wordpress.org/${team}/wp-json/wp/v2/${handbook}/`
  )

  getAll(wp.handbooks()).then(async allPosts => {
    let rootPath = ''
    for (const item of allPosts) {
      if (parseInt(item.parent) === 0) {
        rootPath = item.link.split(item.slug)[0]
        break
      } else {
        rootPath = `https://${subdomain}wordpress.org/${team}/${handbook}/`
      }
    }
    for (const item of allPosts) {
      const path = item.link.split(rootPath)[1].replace(/\/$/, '')
      const filePath =
        path.split('/').length > 1
          ? path.substring(0, path.lastIndexOf('/')) + '/'
          : ''
      await mkdirp(`${outputDir}/${filePath}`, err => {
        if (err) {
          console.log(err)
        } else {
          fs.writeFile(`${outputDir}/${path}.md`, item.content, err => {
            if (err) {
              throw err
            } else {
              console.log(`Created ${path}.md`)
            }
          })
        }
      })
    }
  })
}

program
  .version('1.0.0')
  .arguments('<team>')
  .description('Generate a menu JSON file for WordPress.org handbook')
  .option(
    '-b, --handbook <handbook>',
    'Specify handbook name (default "handbook")'
  )
  .option(
    '-s, --sub-domain <subdomain>',
    'Specify subdomain, for example, "developer" for developer.w.org, "w.org" for w.org (default "make")'
  )
  .option(
    '-o --output-dir <outputDir>',
    'Specify directory to save files (default en/)'
  )
  .action((team, options) => {
    generateJson(team, options.handbook, options.subDomain, options.outputDir)
  })

program.parse(process.argv)
