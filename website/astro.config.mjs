import prefetch from "@astrojs/prefetch";
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import tailwindcssVite from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: "start-streaming",
			defaultLocale: "root", // optional
			locales: {
				root: {
					label: "English",
					lang: "en", // lang is required for root locales
				},
			},
			social: [
				{
					icon: "github",
					label: "GitHub",
					href: "https://github.com/Enalmada/start-streaming",
				},
			],
			sidebar: [
				{
					label: "Guides",
					items: [
						{
							label: "Getting Started",
							link: "/guides/getting-started/",
						},
						{
							label: "Technology Comparison",
							link: "/guides/comparison/",
						},
						{
							label: "Deploy Website",
							link: "/guides/website/",
						},
					],
				},
				{
					label: "Technologies",
					items: [
						{
							label: "Summary",
							link: "/technologies/summary/",
						},
						{
							label: "Architecture",
							link: "/technologies/architecture/",
						},
						{
							label: "Build",
							link: "/technologies/build/",
						},
					],
				},
			],
			customCss: ["./src/assets/landing.css", "./src/tailwind.css"],
		}),
		react(),
		prefetch(),
		tailwindcssVite(),
	],
});
