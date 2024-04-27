# Streamshield nodejs library

## About

The Streamshield node client library is intended to speed up building plugins for applications that are built with node. The intention is for it to help speed up building plugins for other applications that are built with node, for example CMS's.

## Example

```
import Streamshield from '../streamshield-nodejs-plugin'

const ss = new Streamshield()
ss.setApiKey('<your API access key>', '<your API secret key'>)

// First time registration

await ss.register('My CMS', 'v1.0.0', 'v1.0.0') // e.g. CMS version and your plugin version

// Send content for moderation

const meta = {
  domain: '<domain registered in Streamshield>',
  scheme: 'https',
  username: '<the author of the content>',
  ip_address: '<the ip address of the author, if known>',
  content_path: 'https://yourdomain.com/path/to/content',
  action: 'created',
  status: 'PENDING'
}

// Add content

const fields = [
  {
    id: 'title',
    type: 'string',
    value: 'Moderate this string of text!',
    hash: '<SHA1 of value>'
  },
  {
    id: 'image',
    type: 'file',
    value: '/relative/path/to/file', // Streamshield will attempt to retrieve the content remotely
    hash: '<SHA1 of file on disk>'
  },
  ...
]

// Moderate

const response = await ss.moderate(meta, fields)

if(response) {
  // Content has been moderated, check Streamshield dashboard
} else {
  // errors
}

```
