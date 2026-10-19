import {readFile,stat} from 'node:fs/promises';
import nodemailer from 'nodemailer';
import {validEmail} from './notification-service.mjs';
export async function loadMailTransport(file){
 const info=await stat(file);
 if(!info.isFile() || info.mode & 0o077)throw new Error('Private mail settings required');
 const config=JSON.parse(await readFile(file,'utf8'));
 if(typeof config.host!=='string' || !/^[a-zA-Z0-9.:-]+$/.test(config.host) || !Number.isInteger(config.port) || config.port<1 || config.port>65535 || !validEmail(config.from) || (config.secure!==undefined && typeof config.secure!=='boolean') || (config.requireTLS!==undefined && typeof config.requireTLS!=='boolean') || (config.username!==undefined && (typeof config.username!=='string' || !config.username || typeof config.password!=='string' || !config.password)))throw new Error('Invalid mail settings');
 const transport=nodemailer.createTransport({host:config.host,port:config.port,secure:config.secure??config.port===465,requireTLS:config.requireTLS??true,...(config.username?{auth:{user:config.username,pass:config.password}}:{}),connectionTimeout:10000,greetingTimeout:10000,socketTimeout:30000,logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true});
 return {from:config.from,send:message=>transport.sendMail(message)};
}
