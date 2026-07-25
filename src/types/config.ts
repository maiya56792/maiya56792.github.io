import type { AUTO_MODE, DARK_MODE, LIGHT_MODE } from "@constants/constants";

export type SiteConfig = {
	title: string;
	subtitle: string;

	lang:
		| "en"
		| "zh_CN"
		| "zh_TW"
		| "ja"
		| "ko"
		| "es"
		| "th"
		| "vi"
		| "tr"
		| "id";

	themeColor: {
		hue: number;
		fixed: boolean;
	};
	banner: {
		enable: boolean;
		src: string;
		position?: "top" | "center" | "bottom";
		credit: {
			enable: boolean;
			text: string;
			url?: string;
		};
	};
	toc: {
		enable: boolean;
		depth: 1 | 2 | 3;
	};

	favicon: Favicon[];
};

export type Favicon = {
	src: string;
	theme?: "light" | "dark";
	sizes?: string;
};

export type HeroConfig = {
	enable: boolean;
	/** 背景图路径，相对 /src 目录；以 '/' 开头则相对 /public */
	src: string;
	/**
	 * 是否尊重系统的「减少动画」偏好（prefers-reduced-motion: reduce）。
	 * true（默认）：命中该偏好时不启动 Canvas，只留静态背景图。
	 * false：无视系统偏好，始终播放雾/雨/涟漪。
	 */
	respectReducedMotion: boolean;
	fog: {
		opacity: number;
		eraseRadius: number;
		restoreSpeed: number;
	};
	rain: {
		enable: boolean;
		count: number;
		speed: number;
	};
	ripple: {
		enable: boolean;
		maxCount: number;
	};
};

export enum LinkPreset {
	Home = 0,
	Archive = 1,
	About = 2,
	Categories = 3,
	Tags = 4,
}

export type NavBarLink = {
	name: string;
	url: string;
	external?: boolean;
};

export type NavBarConfig = {
	links: (NavBarLink | LinkPreset)[];
};

export type ProfileConfig = {
	avatar?: string;
	name: string;
	bio?: string;
	links: {
		name: string;
		url: string;
		icon: string;
	}[];
};

export type LicenseConfig = {
	enable: boolean;
	name: string;
	url: string;
};

export type LIGHT_DARK_MODE =
	| typeof LIGHT_MODE
	| typeof DARK_MODE
	| typeof AUTO_MODE;

export type BlogPostData = {
	body: string;
	title: string;
	published: Date;
	description: string;
	tags: string[];
	draft?: boolean;
	image?: string;
	category?: string;
	prevTitle?: string;
	prevSlug?: string;
	nextTitle?: string;
	nextSlug?: string;
};

export type ExpressiveCodeConfig = {
	theme: string;
};
