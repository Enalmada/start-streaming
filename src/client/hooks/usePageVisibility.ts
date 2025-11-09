/**
 * Page Visibility Hook
 *
 * Detects when the browser tab is visible or hidden.
 * Useful for pausing streaming when user isn't actively viewing the page
 * to save battery and reduce server load.
 *
 * Inspired by fetch-event-source's Page Visibility API integration.
 * See: https://github.com/Azure/fetch-event-source
 */

import { useEffect, useState } from "react";

/**
 * Returns true if the page is currently visible, false if hidden
 *
 * @example
 * function MyComponent() {
 *   const isVisible = usePageVisibility();
 *
 *   useEffect(() => {
 *     if (isVisible) {
 *       console.log('User is looking at the page');
 *     } else {
 *       console.log('User switched tabs or minimized window');
 *     }
 *   }, [isVisible]);
 * }
 */
export function usePageVisibility(): boolean {
	const [isVisible, setIsVisible] = useState(() => {
		// SSR-safe: default to visible
		if (typeof document === "undefined") return true;
		return !document.hidden;
	});

	useEffect(() => {
		// SSR guard
		if (typeof document === "undefined") return;

		const handleVisibilityChange = () => {
			setIsVisible(!document.hidden);
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);

		// Set initial state
		setIsVisible(!document.hidden);

		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, []);

	return isVisible;
}
