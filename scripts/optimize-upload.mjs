// Local, opt-in encoding before upload. Never modifies an input or cloud object.
import {spawnSync} from 'node:child_process';
import {mkdir,stat,unlink} from 'node:fs/promises';
import path from 'node:path';
const [input,outputDirectory]=process.argv.slice(2);
if(!input||!outputDirectory)throw Error('Usage: node scripts/optimize-upload.mjs <input.mp4> <new-output-directory>');
const source=path.resolve(input),directory=path.resolve(outputDirectory),output=path.join(directory,path.basename(source));
if(source===output)throw Error('Output must be separate from the original');
await mkdir(directory,{recursive:true});
const ffmpeg=process.env.FFMPEG_PATH||path.resolve('../work/media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe');
const result=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-n','-i',source,'-map','0:v:0','-map','0:a:0?','-vf',"scale=w='min(1080,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",'-c:v','libx264','-preset','medium','-crf','22','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',output],{stdio:'inherit'});
if(result.error)throw result.error;if(result.status)throw Error('Encoding failed; original retained');
const before=(await stat(source)).size,after=(await stat(output)).size;
if(after>=before){await unlink(output);console.log(JSON.stringify({useOriginal:true,before,reason:'Encoding was not smaller; original retained'}));}
else console.log(JSON.stringify({output,before,after,savedPercent:Math.round((1-after/before)*100),note:'Review picture/subtitles/audio before uploading; original retained'}));
