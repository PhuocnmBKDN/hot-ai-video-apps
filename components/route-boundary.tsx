import {Component,type ReactNode} from 'react';
export default class RouteBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true}}
 componentDidCatch(error:Error){if(/dynamically imported module|loading chunk|module script|importing a module/i.test(error.message))window.dispatchEvent(new Event('hotai-boot-error'))}
 render(){return this.state.failed?<main className="legal"><section className="panel"><h1>Chưa tải được ứng dụng</h1><p>Kiểm tra kết nối hoặc tải lại để nhận phiên bản mới.</p><button className="button" onClick={()=>location.reload()}>Tải lại trang</button><a className="mini" href="/">Về trang chủ</a></section></main>:this.props.children}
}
