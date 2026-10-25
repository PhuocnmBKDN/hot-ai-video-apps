'use client';
import {useState} from 'react';
export type Recipient={bank:string;account:string;name:string};
export default function PaymentTransfer({recipient,orderId='',amount=10000,qr=true}:{recipient:Recipient;orderId?:string;amount?:number;qr?:boolean}){
 const [copied,setCopied]=useState('');
 async function copy(label:string,value:string){try{await navigator.clipboard.writeText(value);setCopied('Đã sao chép '+label.toLowerCase())}catch{setCopied('Không sao chép tự động được. Nhấn giữ vào ô để sao chép.')}}
 const rows=[{label:'Ngân hàng',value:recipient.bank},{label:'Số tài khoản',value:recipient.account},{label:'Chủ tài khoản',value:recipient.name},{label:'Số tiền (VND)',value:String(amount)}];
 if(orderId)rows.push({label:'Nội dung chuyển khoản',value:orderId});
 return <div className="payment-transfer">{qr&&<img className="qr bank-qr" src="/api/qr" alt={'QR chuyển khoản '+recipient.bank+' — '+recipient.name}/>}<div className="transfer-fields">{rows.map(row=><div className="transfer-row" key={row.label}><label>{row.label}<input aria-label={row.label} readOnly value={row.value}/></label><button type="button" className="mini" onClick={()=>copy(row.label,row.value)} aria-label={'Sao chép '+row.label.toLowerCase()}>Sao chép</button></div>)}</div><p className="copy-feedback" role="status">{copied}</p>{!orderId&&<p className="muted">Nội dung chuyển khoản riêng được cấp khi khách tạo đơn. Đây là bản xem trước, không chuyển tiền.</p>}<p className="notice">QR tĩnh chưa điền sẵn số tiền và nội dung. Nhập đúng <b>{amount.toLocaleString('vi-VN')}đ</b>{orderId&&<> và mã đơn <b>{orderId}</b></>} trong ứng dụng ngân hàng. Kiểm tra tên người nhận trước khi xác nhận chuyển.</p></div>
}
