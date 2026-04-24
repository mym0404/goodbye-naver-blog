---
title: "[Android] Android Architecture Component(AAC) #5-1 : Navigation - Basic"
source: https://blog.naver.com/mym0404/221459172607
blogId: mym0404
logNo: 221459172607
publishedAt: 2019-02-06T09:53:27+09:00
category: Architecture
categoryPath:
  - Android
  - Architecture
editorVersion: 2
visibility: public
thumbnail: https://mblogthumb-phinf.pstatic.net/MjAxOTAyMDZfMTA0/MDAxNTQ5NDA2MzAxNjMx.yvJrtmBJP1HOloCZfCfI_oo4xxnZbqhEtct2h4sbWpAg.RY6DIb_lok5SJBDO-1pmxfY_z9zpLdab7jhCsp4cphIg.PNG.mym0404/1.png?type=w800
warnings:
  - SE2 GIF video 블록을 구조화하지 못해 원본 HTML로 보존했습니다.
  - fallback HTML 블록 1개가 포함됩니다.
---

## Export Diagnostics

> ⚠️ Warning: SE2 GIF video 블록을 구조화하지 못해 원본 HTML로 보존했습니다.

> ⚠️ Warning: fallback HTML 블록 1개가 포함됩니다.

**\[AAC의 Navigation Component의 필요성\]**

우리는 이제까지 액티비티나 프라그먼트를 사용하며 startActivity 혹은 startActivityForResult 메서드나, Fragment Manager와 Transaction 을 이용해서 코드를 열심히 짜왔다.

이 부분에 있어서, 너무나 당연한 동작들이지만 어쩔 땐 구현하기 번거로운 기능들, 예를 들어, custom transition에 대한 코드를 삽입한다던지, Deep link의 동작을 적절히 한다던지, Navigation 컴포넌트(DrawerLayout, BottomNavigationView, TabLayout)등을 사용한다던지에 대해서 구현의 어려움을 느껴왔다.

예를 들어, 프라그먼트는 Back Button에 대한 콜백을 받지 않는다.

우리가 프라그먼트를 겹겹이 쌓고, Back Button을 누를 때 한겹씩 pop 되는 기능을 구현시키려면 Activity의 onBackPressed() 메소드를 오버라이딩하고 복잡한 콜백의 구조를 형성해야 했다.

이는 실제로 필자가 최근에 개발하던 프로젝트에서 사용한 방법이었으며, 프라그먼트 동작에 있어서 childFragmentManager를 사용해야 하는 지 뭐 어떻게 해야 하는 지 힘들었던 기억이 있다.

서론이 조금 길었다.

**\[Navigation Architecture Component\]**

**Navigation Architecture Component**는 이러한 기능들을 고차원의 API를 제공하여 추상화시키는 것 뿐만 아니라, 시각적인 **그래프 에디터**도 제공하며 네비게이션에 대한 기능을 쉽게 구현할 수 있게 도와준다.

Navigation Component가 제공하는 여러 기능들을 조금만 더 살펴보자.

**1\. 프라그먼트 Transaction을 제어**

**2\. Up, Back 버튼을 의도한 대로 동작하도록 제어**

**3\. 애니메이션과 transition에 대한 표준화된 리소스를 제공**

**4\. 딥 링킹을 일급 객체로 처리**

**5\. 최소한의 작업으로 Navigation UI 패턴들을 처리할 수 있게 도와줌 : DrawerLayout, BottomNavigationView, 툴바 메뉴 등**

**6\. navigating 과정에서 전달하는 인자가 필요할 때, type safety 한 방식을 지원(플러그인 사용)**

**7\. Navigation Editor를 이용해 Android Studio에서 시각화하여 네비게이션을 표시할 수 있음**

이것 이외에도 Navigation Architecture Component가 동작하는 몇가지의 디자인 원칙들이 있는데, 자세한 내용은 포스팅 하단의 공식 도큐멘트를 참조하자.

빠르게 개념으로 넘어가려 한다.

**\[네비게이션 에디터\]**

우리가 네비게이션 컴포넌트를 공부하는 이유는 절반 이상이 비쥬얼 에디터를 사용하는 것에 있다.

이는 **Android Studio 3.3 이상 버전**부터 지원된다. 현재 최신 버전은 3.3이다.

![](https://mblogthumb-phinf.pstatic.net/MjAxOTAyMDZfMTA0/MDAxNTQ5NDA2MzAxNjMx.yvJrtmBJP1HOloCZfCfI_oo4xxnZbqhEtct2h4sbWpAg.RY6DIb_lok5SJBDO-1pmxfY_z9zpLdab7jhCsp4cphIg.PNG.mym0404/1.png?type=w800)

이러한 네비게이션 에디터를 안드로이드 스튜디오 에서 사용할 수 있게 된다.

이러한 그래프 구조 하나를 **네비게이션 그래프** 라고 부른다.

예상했을 지도 모르지만, 네비게이션 그래프는 **res/navigation** 리소스 폴더 내에 **xml 파일**로 정의된다.

**<navigation>, <action>** 등 태그를 이용해서 말이다.

**Destination** 이란 우리가 네비게이션으로 갈 수 있는 요소를 의미한다.

각각의 네비게이션 그래프나 서브그래프는 하나의 **Start Destination**을 가져야 한다.

보통 **Destination은 프라그먼트 하나의 스크린을 의미**하지만,

특수한 경우 **액티비티**나, **다른 네비게이션 그래프**나 **서브그래프**, **사용자 정의 destination** 등으로도 정의되어질 수 있다.

Navigation Component는 **하나의 액티비티가 하나의 네비게이션 그래프의 Host**로 동작하고(NavHostFragment를 갖고) 네비게이션 그래프 내의 여러 프라그먼트들을 스와핑해주는 역할을 담당하는 것이 기본 개념이다.

여러가지의 액티비티가 있는 프로젝트라면, 여러 네비게이션 그래프도 존재해야 한다. 각 액티비티는 하나의 네비게이션 그래프의 호스트로 동작해야 한다.

**\[Gradle 설정\]**

모듈 레벨의 build.gradle 에 다음과 같은 의존성을 추가하자.

| dependencies { def nav_version = "1.0.0-beta01" implementation "android.arch.navigation:navigation-fragment-ktx:$nav_version" // use -ktx for Kotlin implementation "android.arch.navigation:navigation-ui-ktx:$nav_version" // use -ktx for Kotlin}Colored by Color Scripter | cs |
| --- | --- |

코틀린 확장 기능을 이용하려면 버전을 나타내는 : 표시 앞에 **-ktx**를 붙여주자.

**\[네비게이션 그래프 만들기\]**

**res/navigation** 디렉토리를 만들어준다.

그리고 새로운 네비게이션 그래프 리소스를 추가한다.

![](https://mblogthumb-phinf.pstatic.net/MjAxOTAyMDZfMjgw/MDAxNTQ5NDA2OTYyMTAy.JqAlezHXkvq594ffJ24I9R3mEpWGCFqM4Z4jyzxUPIwg.6V6BfsH0z-yLdaWUyKiOkti0HbRbS-_2OaKCEN38Opcg.JPEG.mym0404/123.jpg?type=w800)

그러면 다음과 같이 리소스 파일이 만들어진다.

| <?xml version="1.0" encoding="utf-8"?><navigation xmlns:android="http://schemas.android.com/apk/res/android" xmlns:app="http://schemas.android.com/apk/res-auto" android:id="@+id/navigation_graph"> </navigation>Colored by Color Scripter | cs |
| --- | --- |

그리고 Design 탭으로 가면 드디어 비쥬얼 에디터가 보인다.

처음엔 아무 것도 없다.

![](https://mblogthumb-phinf.pstatic.net/MjAxOTAyMDZfMjYw/MDAxNTQ5NDA3MDg4MzY5.RDSwMtqm50gkX9edQnJTNQun_FRV1_ADD_AavLpEljog.y2Sq0g8Wfi6pQZz0uaTC8cUOnaFl3LbiYYX2_2C07UIg.JPEG.mym0404/123.jpg?type=w800)

**1\. Destinations :** 현재 네비게이션 그래프에서 Destination들의 집합이다.

HOST는 네비게이션 그래프의 호스트로 작동할 액티비티를 의미한다. 아직 정해주지 않았다.

**2\. Graph Editor** : 그래프가 보일 공간이다.

**3\. Attributes** : 속성들을 표시할 탭이다.

네모난 추가 버튼을 누르면 다음과 같은 화면을 볼 수 있다.

![](https://mblogthumb-phinf.pstatic.net/MjAxOTAyMDZfMjUg/MDAxNTQ5NDA3MjU1NjUy.JkoZNZ8xQutedP6O4mx4JZqPIyAPnId52LpPuzkmLbUg.76FwF3cXAAjil5Wdqt_Hn7m1jXr5Pq4qqS4Wvmzqwmgg.JPEG.mym0404/123.jpg?type=w800)

Destination으로 추가할 수 있는 것들의 목록이다. **새로운 프라그먼트**를 만들거나, **placeholder**(런타임 때는 placeholder를 다른 명시적 Destination으로 교체해주고 실행해야 함), **기존의 프라그먼트**, **액티비티**, 다른 **네비게이션 그래프** 등을 하나의 그래프 요소(Destination)로써 사용할 수 있다.

나는 편의를 위해 두 개의 프라그먼트를 만들었다.

프라그먼트를 만드는 방법은 다음과 같다.

![](https://mblogthumb-phinf.pstatic.net/MjAxOTAyMDZfMTcw/MDAxNTQ5NDA4MTYzODM5.Gt7bDhJDvgKMgUEcDVwzCs07SsXIRpICHzzaW3cE1T8g.HthDKKY-5jfgRHrhJFQPCnQG8Ln_Jl98LCTybKVuYRkg.JPEG.mym0404/123.jpg?type=w800)

\[Create new destination\] 을 누른 다음에, 프라그먼트의 이름과, 만들어질 레이아웃 이름을 설정한다.

그렇게 두 개를 만들었다.

![](https://mblogthumb-phinf.pstatic.net/MjAxOTAyMDZfMTI5/MDAxNTQ5NDA4MjIwMTg5.QlE_t8ePrULYLF_G0ZWdNZFSSrNN_hxg0M5uCxmXDW8g.1TDrttL58WVn-BnPUn_rZhUeLFpQoY3xCNDjcWmGj3sg.JPEG.mym0404/123.jpg?type=w800)

**Action**을 추가하는 법은 아직 배우지 않았지만, 그냥 선을 이으면 된다.

저런 **화살표 하나를 action**이라고 한다.

Start Destination은 네비게이션 그래프에서 시작이 되는 화면을 의미한다.

예를 들어, 어떤 액티비티가 시작되고 이 네비게이션 그래프를 호스팅한다면, 제일 처음 보이는 화면은 blankFragment이다. 이름 옆에 집 표시의 아이콘이 보이는가?

저걸 설정해주려면 Destination을 누르고 이 버튼을 누르던가, 네비게이션 그래프의 Attributes 탭에서 Start Destination을 설정해주면 된다.

![](https://mblogthumb-phinf.pstatic.net/MjAxOTAyMDZfMjYx/MDAxNTQ5NDA4Mzg4Mzc0.Z4k2SAc70iB745j8j3hbIanzLjRfTFay1xUyMrWsNeYg.UUCr3qIanKMS6X4kYIP3a8D_QyY_yGXhjAelsvD2hJ8g.JPEG.mym0404/123.jpg?type=w800)

현재 어떤 요소가 활성화되있느냐에 따라 Attribute 탭에 설정할 수 있는 항목들이 바뀌는데,

Destination을 클릭한 상태이면 해당 Destination의 속성을 설정할 수 있고, 빈 공간을 클릭해서 모두 비활성화 시키면 네비게이션 그래프 자체의 속성을 변경할 수 있다.

이제 XML 파일을 한번 살펴보자.

| <?xml version="1.0" encoding="utf-8"?><navigation xmlns:android="http://schemas.android.com/apk/res/android" xmlns:app="http://schemas.android.com/apk/res-auto" xmlns:tools="http://schemas.android.com/tools" android:id="@+id/nav_graph" app:startDestination="@id/blankFragment"> <fragment android:id="@+id/blankFragment" android:name="org.mjstudio.navigationsample.BlankFragment" android:label="fragment_blank" tools:layout="@layout/fragment_blank"> <action android:id="@+id/action_blankFragment_to_blankFragment2" app:destination="@id/blankFragment2" > </action> </fragment> <fragment android:id="@+id/blankFragment2" android:name="org.mjstudio.navigationsample.BlankFragment2" android:label="fragment_blank_fragment2" tools:layout="@layout/fragment_blank_fragment2"/> </navigation>Colored by Color Scripter | cs |
| --- | --- |

루트 **<navigation>** 태그에 **startDestination**이 설정된 것을 보아라.

또한 프라그먼트들은 **<fragment>** 로 표시가 되어있고, 액션은 **<action>** 태그로 정의되어있는데, 하나의 액션은 화살표를 방출하는 Destination 에게 귀속되어 있고 목적지 Destination에 대한 정보를 담고 있음을 알 수 있다.

또한, 각 요소들은 id를 갖고, 이는 소스 코드에서 사용되어진다.

**\[액티비티를 호스트 내비게이션으로 설정하기\]**

앞서 하나의 네비게이션 그래프는 하나의 액티비티가 호스팅을 해야 한다고 언급했다.

이제 액티비티가 어떻게 그런 역할을 하도록 설정해줄 수 있는 지 알아보자.

액티비티는 **NavHost** 내에서 네비게이션을 호스팅 해줄 수 있다. NavHost는 빈 컨테이너로써 Destination의 화면들을 스왑시키며 보여줄 수 있다.

Navigation Component은 기본적으로 NavHost의 구현에 **NavHostFragment**를 사용한다.

구체적인 구현법은 다음과 같다.

1\. 액티비티의 레이아웃 파일에 다음과 같은 프라그먼트 태그를 원하는 위치에 추가한다.

| <fragment android:id="@+id/nav_host_fragment" android:name="androidx.navigation.fragment.NavHostFragment" android:layout_width="match_parent" android:layout_height="match_parent" app:layout_constraintLeft_toLeftOf="parent" app:layout_constraintRight_toRightOf="parent" app:layout_constraintBottom_toBottomOf="parent" app:defaultNavHost="true" app:navGraph="@navigation/nav_graph" />Colored by Color Scripter | cs |
| --- | --- |

id를 설정해주고, 객체화해줄 프라그먼트 클래스의 이름을 **NavHostFragment**로 설정한다.

그리고 두 가지 설정을 해준다.

| app:defaultNavHost = "true" | cs |
| --- | --- |

로 설정해준 건, 뒤로 가기 버튼을 눌렀을 때 그 이벤트를 인터셉트 해주기 위함이다.

이 포스팅의 서두에 설명했던 프라그먼트의 뒤로 가기 버튼 문제를 쉽게 해결할 수 있다.

또한 이는 프로그래밍 적으로도 AppCompatActivity.onSupportNavigationUp() 메소드를 오버라이딩 하여 사용할 수 있다.

| override fun onSupportNavigateUp() = findNavController(R.id.nav_host_fragment).navigateUp() | cs |
| --- | --- |

근데 필자는 프로그래밍으로 하는 구현 방식이 안된다.

여하튼 이러한 작업을 거친 후에는 네비게이션 에디터에서 **HOST** 가 나타난다.

![](https://mblogthumb-phinf.pstatic.net/MjAxOTAyMDZfNTYg/MDAxNTQ5NDEyNTI3MTQ2.1Cl759pnrstgH6DzhNuAXzh2rBUP4YeCD3xW_e3bkmcg.kkuTVIGSJjewGnuqWzFC1M0RAZ5yV6AW-Hp_BXdJoicg.JPEG.mym0404/123.jpg?type=w800)

위와 같이 레이아웃에서 직접 정의한는 방식 말고 **NavHostFragment**를 생성해서 트랜잭션을 이용해 프라그먼트를 설정해줄 수 있다.

| val finalHost = NavHostFragment.create(R.navigation.example_graph)supportFragmentManager.beginTransaction() .replace(R.id.nav_host, finalHost) .setPrimaryNavigationFragment(finalHost) // this is the equivalent to app:defaultNavHost="true" .commit()Colored by Color Scripter | cs |
| --- | --- |

.setPrimaryNavigationFragment 메소드로 app:defaultNavHost 속성을 변경하는 것과 동일한 효과를 줄 수 있다.

**\[NavController\]**

우린 **NavController** 객체를 이용해, 정의해둔 액션을 사용하는 등, **네비게이션을 실행**시켜줄 수 있다.

NavController 객체를 얻는 법은 여러 가지가 있다.

| NavHostFragment.findNavController(Fragment)Navigation.findNavController(Activity, @IdRes int viewId)Navigation.findNavController(View) | cs |
| --- | --- |

위와 같은 방식으로 Static 메서드 들을 이용하면 객체를 얻을 수 있다.

2번 방법에서 viewId 인자는 NavHostFragment 프라그먼트 레이아웃 아이디이다.

3번 방법에서 View 객체는 NavHostFragment 객체이다.

위와 같은 방법으로 **NavController** 객체를 얻은 후에는, 그것의 **navigate()** 메서드를 이용해 **Destination으로 네비게이션을 진행**시켜 줄 수 있다!

![](https://mblogthumb-phinf.pstatic.net/MjAxOTAyMDZfMjgz/MDAxNTQ5NDEyODA3NTAz.lskQXbssa126_hCej5jfAP-9OG4e6kpWky50Gw6_boUg.6TDUIEVvsuBkITM9wVhalDARX0WYZiOIvuiN80gPgEwg.JPEG.mym0404/123.jpg?type=w800)

위와 같은 오버로딩 들이 존재한다. **리소스 아이디엔 액션 태그의 아이디**를 넣어주면 된다.

네비게이션엔 내부적으로 **back stack**이 쓰인다. 최근에 방문한 **destination은 스택의 top**이고, **뒤로 돌아갈 때마다 pop** 되는 동작을 이해하면 된다.

Up 이나 Back 버튼을 누르는 것은 **NavController.navigateUp()** 메서드나, **NavController.popBackStack()** 메서드를 호출해주는 것과 동일하다.

**\[Transition\]**

화면을 전환할 때 어떤 애니메이션을 적용시켜주는 것은 중요하다.

적절한 애니메이션의 효과에 따라 UX의 질은 향상된다.

네비게이션 에디터를 이용해 굉장히 쉽게 정의가 가능하다.

![](https://mblogthumb-phinf.pstatic.net/MjAxOTAyMDZfMjE2/MDAxNTQ5NDEzMDQ3MzUz.cwsmqnXoZVAp7atDE4fGTYugV4Eilt0b3hQScz7x2e0g.xYmwG7cIj7lC4n2ShgOBGoLXqH1eUnWnSPHjsdMuPKAg.JPEG.mym0404/123.jpg?type=w800)

눈으로 보기만 해도 아, 저렇게 쓰는 거구나 할 것이다.

액션을 활성화시키면 Attribute 탭에 애니메이션을 정할 수 있는 항목이 나온다.

Text 파일을 보자.

| <action android:id="@+id/action_blankFragment_to_blankFragment2" app:destination="@id/blankFragment2" app:enterAnim="@anim/nav_default_enter_anim" app:exitAnim="@anim/nav_default_exit_anim"> | cs |
| --- | --- |

<action> 태그만 편의상 가져왔고, 애니메이션에 관련된 속성에 @anim 리소스를 삽입해준 것을 볼 수 있다.

**\[Shared Element Transition\]**

Shared Element Transition을 구현하기 위해서는 프로그래밍적인 코드가 필요하다.

transitionName이나 뷰를 참조해서 옵션을 정의해줘야 하기 때문이다.

크게 어렵지 않다.

| val extras = FragmentNavigatorExtras( imageView to "header_image", titleView to "header_title")view.findNavController().navigate(R.id.confirmationAction, null, // Bundle of args null, // NavOptions extras)Colored by Color Scripter | cs |
| --- | --- |

navigate 메서드의 4번 째 인자로 FragmentNavigatorExtras 객체를 전달해준다.

여기서 imageView to "header\_image"는 header\_image란 transition name을 갖는 imageView 객체를 Pair로 묶어준 것이다.

코틀린의 infix operator 문법임을 유의하자.

위는 프라그먼트끼리의 transition 에서 shared element transition을 정의해준 것이고, 액티비티끼리의 화면 전환에서 사용해주려면 조금 다르다.

| // Rename the Pair class from the Android framework to avoid a name clashimport android.util.Pair as UtilPair...val options = ActivityOptionsCompat.makeSceneTransitionAnimation(activity, UtilPair.create(imageView, "header_image"), UtilPair.create(titleView, "header_title"))val extras = ActivityNavigator.Extras(options)view.findNavController().navigate(R.id.details, null, // Bundle of args null, // NavOptions extras)Colored by Color Scripter | cs |
| --- | --- |

ActivityOptionsCompat 객체를 만드는 것은 액티비티간의 화면 전환에서 배운 적이 있다.

그 옵션 객체를 ActivityNavigator.Extras() 메서드를 사용해서 Extras 객체를 얻어주고, 마찬가지로 navigate 메서드의 4 번째 인자로 전달한다.

options가 잘 작동하게 해주기 위해선 styles.xml 파일에서 shared element 트랜지션을 적절히 정의해주어야 한다

**\[예제\]**

프라그먼트 간, Shared Element Transition이 잘 안되는 것을 발견했다.

찾아보니 **두 번째 프라그먼트의 초기화 과정에서 Shared Element Transition 객체를 설정**해주어야 하는 것이었다.

[
How to use shared element transitions in Navigation Controller
I would like to add a shared elements transition using the navigation architecture components, when navigating to an other fragment. But I have no idea how. Also in the documentations there is noth...
stackoverflow.com
](https://stackoverflow.com/questions/50599360/how-to-use-shared-element-transitions-in-navigation-controller)

![](https://ssl.pstatic.net/static/blog/blank.gif)

두 번째 프라그먼트의 레이아웃에서 다음과 같이 imageView의 transitionName을 설정한다.

| <ImageView android:transitionName="secondImageView" android:src="@mipmap/ic_launcher" android:layout_width="0dp" android:layout_height="300dp" android:id="@+id/imageView" app:layout_constraintEnd_toEndOf="parent" android:layout_marginEnd="8dp" android:layout_marginRight="8dp" app:layout_constraintStart_toStartOf="parent" android:layout_marginLeft="8dp" android:layout_marginStart="8dp" android:layout_marginBottom="8dp" app:layout_constraintBottom_toBottomOf="parent"/> | cs |
| --- | --- |

| mContainer.button_navigation.setOnClickListener { val navController = findNavController() val extras = FragmentNavigatorExtras( imageView to "secondImageView" ) navController.navigate(R.id.action_blankFragment_to_blankFragment2,null,null,extras) }Colored by Color Scripter | cs |
| --- | --- |

그리고 위와 같이 navigate 메서드를 호출해주고,

두 번째 프라그먼트의 onCreateView를 다음과 같이 정의했다.

| override fun onCreateView( inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle? ): View? { if(Build.VERSION.SDK_INT >= 19) { sharedElementEnterTransition = ChangeBounds().apply { duration = 500 } sharedElementReturnTransition = ChangeBounds().apply { duration= 500 } } // Inflate the layout for this fragment return inflater.inflate(R.layout.fragment_blank_fragment2, container, false) }Colored by Color Scripter | cs |
| --- | --- |

결과물을 보자!

<p><video src="https://mblogvideo-phinf.pstatic.net/MjAxOTAyMDZfMTUz/MDAxNTQ5NDEzOTc5ODQy.dIfNXspKNS2I29ivFYqiUMxLCDJV17xWrtjut7p5etEg.Cwrfu83gmXKmtAz3wIAi-nOGgZtmy9FmvNu6zdDEg_Eg.GIF.mym0404/123.gif?type=mp4w800" loop="loop" muted="muted" playsinline="" class="fx _postImage _gifmp4" data-gif-url="https://mblogthumb-phinf.pstatic.net/MjAxOTAyMDZfMTUz/MDAxNTQ5NDEzOTc5ODQy.dIfNXspKNS2I29ivFYqiUMxLCDJV17xWrtjut7p5etEg.Cwrfu83gmXKmtAz3wIAi-nOGgZtmy9FmvNu6zdDEg_Eg.GIF.mym0404/123.gif?type=w210"></video>&nbsp;</p>

\----------

[
Navigation | Android Developers
Use the Navigation Architecture Component to implement navigation in your app.
developer.android.com
](https://developer.android.com/topic/libraries/architecture/navigation/)

![](https://ssl.pstatic.net/static/blog/blank.gif)
