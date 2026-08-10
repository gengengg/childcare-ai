import { Component, type ReactNode } from 'react';
import { Mascot } from './Mascot';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * 하위 트리에서 렌더 중 예외 발생 시 앱 전체 흰 화면 대신
 * 친화적인 에러 화면 표시. 새로고침 버튼으로 복구 유도.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  handleReload = () => {
    // 상태 리셋 후 홈으로. 새로고침이 더 안전한 케이스가 많음.
    window.location.href = '/';
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-cream-50 flex flex-col items-center justify-center px-6 py-10">
          <Mascot variant="sleep" size={120} className="mb-6" />
          <h1 className="text-[22px] font-extrabold text-ink mb-2 text-center">
            앗! 햄찌가 잠깐 멈췄어요
          </h1>
          <p className="text-[14px] text-subtle text-center leading-relaxed mb-6 max-w-sm">
            예상치 못한 오류가 있었어요. 새로고침하면 다시 정상 동작합니다.
            <br />
            같은 문제가 반복되면 알려주세요.
          </p>
          <button
            onClick={this.handleReload}
            className="btn-primary py-3 px-8"
          >
            새로고침
          </button>
          {import.meta.env.DEV && (
            <details className="mt-8 max-w-md w-full">
              <summary className="text-[12px] text-subtle cursor-pointer">
                개발자 정보 (dev only)
              </summary>
              <pre className="text-[11px] text-red-500 mt-2 overflow-auto p-3 bg-cream-100 rounded-xl">
                {this.state.error.message}
                {'\n\n'}
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
