import {Component,type ReactNode} from 'react';
export default class ChartBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true}}
 render(){return this.state.failed?<p role="alert">此图表组件暂不可用；可继续阅读当前步骤的讲解、原代码与其他结果。重新加载页面后可再次尝试。</p>:this.props.children}
}
