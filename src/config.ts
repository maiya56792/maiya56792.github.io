import type {
	ExpressiveCodeConfig,
	HeroConfig,
	LicenseConfig,
	NavBarConfig,
	ProfileConfig,
	SiteConfig,
} from "./types/config";
import { LinkPreset } from "./types/config";

export const siteConfig: SiteConfig = {
	title: "blacksugar",
	subtitle: "I am",
	lang: "zh_CN",
	themeColor: {
		hue: 214, // 冷蓝主色调
		fixed: true, // 单一配色，隐藏取色器
	},
	// 首页 banner 已由玻璃 hero（HeroGlass）取代，此处保持关闭
	banner: {
		enable: false,
		src: "assets/images/hero-glass.png",
		position: "center",
		credit: {
			enable: false,
			text: "",
			url: "",
		},
	},
	toc: {
		enable: true,
		depth: 2,
	},
	favicon: [],
};

/**
 * 首屏玻璃 hero 配置。
 * Canvas 参数集中在此，便于调试手感，无需改组件源码。
 */
export const heroConfig: HeroConfig = {
	enable: true,
	src: "assets/images/hero-glass.png",
	// 设为 false 可无视系统「减少动画」偏好，强制播放特效
	respectReducedMotion: false,
	// 雾层（只覆盖水面线以上；水区靠折射本身就够朦胧）
	fog: {
		opacity: 0.1, // 初始雾浓度（0~1）；调淡后背景的蝴蝶与雨窗纹理能透出来
		eraseRadius: 110, // 鼠标擦除半径（px）
		restoreSpeed: 0.004, // 雾恢复速度，越大恢复越快
	},
	// 雨滴：垂直下落，落到水面线即消失并激发涟漪
	rain: {
		enable: true,
		count: 18, // 雨滴数量；少而稀疏，能看清单颗落水
		speed: 1.8, // 下落速度基数（0.5~4）
		dropStrength: 1.4, // 落水扰动强度（0.5~3）
	},
	// 涟漪与指针交互
	ripple: {
		enable: true,
		maxCount: 14, // 同时存在的落水闪点上限
		pointerStrength: 0.5, // 鼠标拂水强度（0.1~1.2）
		pointerRadius: 1.8, // 鼠标扰动半径（网格格点数，1~5）
	},
	// 水面：Hugo Elias height-field 双缓冲水波模拟
	water: {
		enable: true,
		lineRatio: 0, // 水面覆盖整个首屏（0 = 从顶部开始）
		simWidth: 220, // 模拟网格宽度，越大越细腻
		perspective: 1.5, // 透视压缩（1~4），越大涟漪越扁
		damping: 0.993, // 阻尼，接近 1 则水面更平静
		refraction: 1.5, // 折射强度（0~6），低值保持背景清晰
		gloss: 12, // 反光强度（0~40）
		tint: 0.04, // 水色浓度，接近 0 则水面近乎透明
		ambient: 0.0015, // 环境微起伏（0~0.01）
	},
};

export const navBarConfig: NavBarConfig = {
	links: [
		LinkPreset.Home,
		LinkPreset.Archive,
		LinkPreset.Categories,
		LinkPreset.Tags,
		LinkPreset.About,
	],
};

export const profileConfig: ProfileConfig = {
	avatar: "assets/images/avatar.png",
	name: "blacksugar",
	bio: "I am",
	links: [
		{
			name: "GitHub",
			icon: "fa6-brands:github",
			url: "https://github.com/maiya56792",
		},
	],
};

export const licenseConfig: LicenseConfig = {
	enable: true,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

export const expressiveCodeConfig: ExpressiveCodeConfig = {
	// 注意：部分样式（如背景色）在 astro.config.mjs 中被覆盖
	theme: "github-dark",
};
