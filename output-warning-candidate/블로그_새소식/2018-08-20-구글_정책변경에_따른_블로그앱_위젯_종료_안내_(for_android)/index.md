---
title: 구글 정책변경에 따른 블로그앱 위젯 종료 안내 (for Android)
source: https://blog.naver.com/blogpeople/221342499699
blogId: blogpeople
logNo: 221342499699
publishedAt: 2018-08-20T18:24:16+09:00
category: 블로그 새소식
categoryPath:
  - 블로그 새소식
editorVersion: 3
visibility: public
exportedAt: 2026-04-22T11:35:01.814Z
---

![](https://mblogthumb-phinf.pstatic.net/MjAxODA4MjBfMTM4/MDAxNTM0NzUyOTUzOTE2.kI321yV4-9fsvg1RK6trB7SwfQJ0vvBuaEb7RWsvSJEg.EjfyyX_OOs_54It8PQNrHYscSHI1Z_qZe4mdBmPeeBQg.PNG.blogpeople/%EC%9C%84%EC%A0%AF_%EC%A2%85%EB%A3%8C.png?type=w800)

안녕하세요.  
블로그서비스팀입니다.  
지난해 12월 구글은 구글 플레이에 앱을 등록할 때, 최신 안드로이드API를 사용한 앱만 등록 할 수 있도록 정책을 변경하였습니다.  
**\* 구글 정책 변경 내용 상세** ([관련링크](https://developers-kr.googleblog.com/2018/01/improving-app-security-and-performance-on-google-play.html))\- 앱의 보안 및 성능을 향상하고, 최신 버전의 안드로이드 경험을 제공하기 위해 정책을 변경함  
\- 정책 변경에 대응하지 않을 경우 올 11월 부터 앱 공급자는 구글 플레이에 앱을 업로드 할 수 없음  
\- 안드로이드API란? 안드로이드가 제공하는 기능을 제어할 수 있게 만든 인터페이스  
위 정책 변경으로 인하여 사용자가 앱을 사용하지 않는 백그라운드 상황에서 별도 기능을 수행하는 장치는 제한을 받게 됩니다.  
블로그 서비스는 안드로이드OS를 사용하는 기기에서 사용자의 편의를 도모하고자 2012년 블로그 위젯 3종 세트를 선보였습니다. 해당 위젯은 블로그 앱을 켜지 않는 상황에서도 API를 이용하여 블로그 방문자수, 이웃새글, 알림등을 볼 수 있는 편리한 기능이었습니다. 하지만 금번 발표된 구글 API 정책변경으로 인하여 블로그앱의 위젯이 블로그서버와 통신을 하는 순간마다 사용자에게 알림을 띄워 데이터 수신을 허락 받아야 하는 상황이 되었습니다. 즉, 앱을 구동하지 않은 상태에서는 실시간성 데이터를 보는것이 사실상 불가능한 상황입니다. 이에 따라 **블로그앱에서 실시간으로 제공되고 있는 3개의 위젯(이웃새글, 내소식, 내블로그) 기능을 부득이 중단하고자 합니다.**

![](https://mblogthumb-phinf.pstatic.net/MjAxODA4MjBfMjkw/MDAxNTM0NzU2OTIwMzAx.Ti4kbgnIqugRHunk_W7k1dPcLHYTMXsAWzh2kmgWyyUg.4oberXNRi2uBYsjIadCRyOggcI2BLbd-274L36exIfcg.PNG.blogpeople/%EC%9C%84%EC%A0%AF%EC%A2%85%EB%A3%8C%EC%95%88%EB%82%B4.png?type=w800)

구글 정책에 대응하기 위하여 **8월 27일** 업데이트 예정인 **블로그앱 v4.1.34** 부터 해당 기능이 제외되어 제공될 예정입니다. 앱을 업데이트 하기 전까지는 현재와 동일하게 위젯 기능을 사용하실 수 있습니다.  
금번에 종료되는 기능들은 블로그앱을 통해서도 확인 가능한 내용들이지만, 앱에 진입하지 않고 볼 수 있다는 장점이 있어 즐겨 사용하는 분들이 계셨던 것으로 알고 있습니다. OS 플랫폼 정책 변경으로 인하여 편리하게 사용했던 기능들을 종료하게 되어 저희도 무척 안타깝게 생각하고 있습니다. 추후 설계 담당자들과 논의하여 블로그앱 진입 즉시 해당 데이터들을 편리하게 모아볼 수 있는 기능이나 페이지를 추가할 수 있을지 검토해보도록 하겠습니다. 불가피하게 위젯 기능을 종료하게 되는 점 깊은 양해 부탁드리며, 보다 안정적인 서비스 지원을 위해 늘 최선을 다하고 있다는 것, 잊지 말아 주세요!!!!

![스티커 이미지](https://storep-phinf.pstatic.net/blogc/original_38.png?type=p100_100)

\* 해당기능은 안드로이드 앱 사용자 대상 공지입니다. (iOS는 해당사항 없음)  
\* 위젯은 알림과는 별개의 기능입니다. 알림은 종전과 같이 지원됩니다.  
감사합니다.
