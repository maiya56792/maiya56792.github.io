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
	// 雾层
	fog: {
		opacity: 0.55, // 初始雾浓度（0~1）；过高会把背景图和雨滴一起糊掉
		eraseRadius: 110, // 鼠标擦除半径（px）
		restoreSpeed: 0.004, // 雾恢复速度，越大恢复越快
	},
	// 雨滴
	rain: {
		enable: true,
		count: 140, // 雨滴数量上限
		speed: 1.8, // 下落速度基数
	},
	// 水波纹（点击/擦除时的涟漪）
	ripple: {
		enable: true,
		maxCount: 12,
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
