export const POSTER_MAX_BYTES=512*1024;
export function assertLightPoster(bytes:Uint8Array){
 if(bytes.byteLength>POSTER_MAX_BYTES)throw Object.assign(new Error('Poster cần được tối ưu xuống tối đa 512 KB trước khi upload. Cập nhật VideoLink hoặc dùng chức năng chọn/dán poster trong quản trị.'),{status:413});
}
