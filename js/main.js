/*
==========================================
THE VAUXHALLS - MAIN JAVASCRIPT
==========================================
Smooth scrolling, parallax effects, navigation
Automotive-inspired interactions
==========================================
*/

(function() {
    'use strict';

    // ==========================================
    // NAVIGATION
    // Glassmorphism effect on scroll
    // Mobile menu toggle
    // ==========================================

    const navbar = document.getElementById('navbar');
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');
    const navLinks = document.querySelectorAll('.nav-link');

    // Navbar scroll effect
    function handleNavbarScroll() {
        if (!navbar) return;

        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }

    // Mobile menu toggle
    function toggleMobileMenu() {
        if (!navToggle || !navMenu) return;

        navToggle.classList.toggle('active');
        navMenu.classList.toggle('active');
        document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
    }

    // Close mobile menu when clicking a link
    function closeMobileMenu() {
        if (!navToggle || !navMenu) return;

        navToggle.classList.remove('active');
        navMenu.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Update active nav link based on scroll position
    function updateActiveNavLink() {
        const sections = document.querySelectorAll('section[id]');
        const scrollPos = window.scrollY + 100;

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');

            if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${sectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }

    // ==========================================
    // SMOOTH SCROLLING
    // Enhanced scroll with easing
    // ==========================================

    function smoothScrollTo(target) {
        const element = document.querySelector(target);
        if (!element) return;

        const navHeight = navbar ? navbar.offsetHeight : 80;
        const targetPosition = element.getBoundingClientRect().top + window.scrollY - navHeight;

        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });
    }

    // Handle anchor link clicks
    function handleAnchorClick(e) {
        const href = e.currentTarget.getAttribute('href');

        if (href && href.startsWith('#')) {
            e.preventDefault();
            smoothScrollTo(href);
            closeMobileMenu();
        }
    }

    // ==========================================
    // PARALLAX EFFECTS
    // Subtle parallax on hero and story sections
    // ==========================================

    const heroMedia = document.getElementById('heroMedia');
    const storyParallax = document.querySelector('.story-parallax');

    function handleParallax() {
        const scrolled = window.scrollY;

        // Hero parallax
        if (heroMedia) {
            const heroSection = document.querySelector('.hero');
            if (heroSection) {
                const heroBottom = heroSection.offsetTop + heroSection.offsetHeight;
                if (scrolled < heroBottom) {
                    heroMedia.style.transform = `translateY(${scrolled * 0.3}px)`;
                }
            }
        }

        // Story parallax
        if (storyParallax) {
            const storySection = document.querySelector('.story');
            if (storySection) {
                const storyTop = storySection.offsetTop;
                const storyBottom = storyTop + storySection.offsetHeight;

                if (scrolled > storyTop - window.innerHeight && scrolled < storyBottom) {
                    const progress = (scrolled - storyTop + window.innerHeight) / (storySection.offsetHeight + window.innerHeight);
                    storyParallax.style.transform = `translateY(${(progress - 0.5) * 100}px)`;
                }
            }
        }
    }

    // ==========================================
    // SCROLL ANIMATIONS
    // Fade in elements on scroll
    // ==========================================

    function initScrollAnimations() {
        const fadeElements = document.querySelectorAll('.fade-in, .section-header, .release-card, .show-item');

        const observerOptions = {
            root: null,
            rootMargin: '0px 0px -50px 0px',
            threshold: 0.1
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    // Add stagger delay for grid items
                    const delay = entry.target.classList.contains('release-card') ||
                                  entry.target.classList.contains('show-item')
                        ? index * 100
                        : 0;

                    setTimeout(() => {
                        entry.target.classList.add('visible');
                    }, delay);

                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        fadeElements.forEach(element => {
            element.classList.add('fade-in');
            observer.observe(element);
        });
    }

    // ==========================================
    // STAGGER ANIMATIONS
    // Animate show items sequentially
    // ==========================================

    function initStaggerAnimations() {
        const showItems = document.querySelectorAll('.show-item');

        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.1
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const items = entry.target.parentElement.querySelectorAll('.show-item');
                    items.forEach((item, index) => {
                        item.classList.add('stagger-item');
                        setTimeout(() => {
                            item.classList.add('visible');
                        }, index * 100);
                    });
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        if (showItems.length > 0) {
            observer.observe(showItems[0]);
        }
    }

    // ==========================================
    // SCROLL INDICATOR
    // Hide on scroll
    // ==========================================

    function handleScrollIndicator() {
        const scrollIndicator = document.querySelector('.scroll-indicator');
        if (!scrollIndicator) return;

        if (window.scrollY > 100) {
            scrollIndicator.style.opacity = '0';
            scrollIndicator.style.pointerEvents = 'none';
        } else {
            scrollIndicator.style.opacity = '1';
            scrollIndicator.style.pointerEvents = 'auto';
        }
    }

    // ==========================================
    // PLAY BUTTONS
    // Placeholder functionality for release cards
    // ==========================================

    function initPlayButtons() {
        const playButtons = document.querySelectorAll('.play-btn');

        playButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                // In production, this would trigger audio playback
                // For now, redirect to Spotify
                window.open('https://open.spotify.com/artist/2dg5NW2EXyujvQfqXokBTd', '_blank');
            });
        });
    }

    // ==========================================
    // UTILITY FUNCTIONS
    // ==========================================

    // Debounce function for scroll events
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Throttle function for scroll events
    function throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // ==========================================
    // EVENT LISTENERS
    // ==========================================

    function initEventListeners() {
        // Scroll events (throttled for performance)
        const handleScroll = throttle(() => {
            handleNavbarScroll();
            handleParallax();
            handleScrollIndicator();
            updateActiveNavLink();
        }, 16); // ~60fps

        window.addEventListener('scroll', handleScroll, { passive: true });

        // Mobile menu toggle
        if (navToggle) {
            navToggle.addEventListener('click', toggleMobileMenu);
        }

        // Navigation links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', handleAnchorClick);
        });

        // Close mobile menu on resize
        window.addEventListener('resize', debounce(() => {
            if (window.innerWidth > 1024) {
                closeMobileMenu();
            }
        }, 250));

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && navMenu && navMenu.classList.contains('active')) {
                closeMobileMenu();
            }
        });
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================

    function init() {
        // Run initial checks
        handleNavbarScroll();

        // Initialize features
        initEventListeners();
        initScrollAnimations();
        initStaggerAnimations();
        initPlayButtons();

        // Add loaded class to body for any CSS transitions
        document.body.classList.add('loaded');

        console.log('The Vauxhalls - Website Initialized');
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
