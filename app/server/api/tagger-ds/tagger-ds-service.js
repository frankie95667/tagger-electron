import axios from 'axios';
import fetch from 'node-fetch';
import fs from 'fs';
import {
  parsedMessagesToDBO,
  addMessagesToDb,
  addTagsToDb
} from './helpers/tagger-ds-processors';
import { Readable } from 'stream';
const io = require('socket.io')(3001);
const dsUrl = process.env.DS_PROD_URL || 'http://localhost:5000';

export const checkNewMail = (lastIndex = null, credentials) => {
  const postCredentials = {
    provider: credentials.provider,
    recent_id: lastIndex,
    token: {
      ...credentials.token,
      // client_id: process.env.GOOGLE_CLIENT_ID,
      client_id: process.env.CLIENT_ID || "604214558845-4n4388nn1gomf9g74hs9iae2r2crrrd9.apps.googleusercontent.com",
      client_secret: process.env.CLIENT_SECRET || "tzpuWx4BIIePG0bH0KGsRbTo"
    }
  };
  console.log(postCredentials);

  return new Promise((resolve, reject) => {
    io.on('connection', socket => {
      fetch(dsUrl + '/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        keepalive: true,
        body: JSON.stringify(postCredentials)
      })
        .then(response => {
          if(response.status !== 200){
            return [response.body, new Error("Something went wrong")]
          }
          return [response.body, null]
        })
        .then(([stream, error]) => {
          let str = '';
          let message;
          let count = 0;
          if(error) reject(error)

          stream.on('data', async chunk => {
            str += chunk.toString('utf-8');
            try {
              message = JSON.parse(str);
              console.log(message);

              console.log('New client connected');
              socket.emit('total_count', message.total_count);
              socket.emit('current_count', message.current_count);

              str = '';
              const parsedMessage = parsedMessagesToDBO(message);
              const addedMessage = await addMessagesToDb(parsedMessage);
              addTagsToDb(addedMessage.id, message.smartTags);
            } catch (error) {}
          });

          stream.on('finish', () => {
            socket.emit("FromAPI", null)
            resolve('done');
          });
        })
    });
  });
  // return axios.post(dsUrl + "/api/sync", {
  //   provider: credentials.provider,
  //   recent_id: lastIndex,
  //   token: {
  //     ...credentials.token,
  //     client_id: process.env.CLIENT_ID,
  //     client_secret: process.env.CLIENT_SECRET
  //   }
  // })
};
