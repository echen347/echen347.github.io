# Personal Academic Website

Source code for my personal academic website, available at [echen347.github.io](https://echen347.github.io).

## Overview

This site is built with **plain HTML** and **Vanilla JavaScript**, styled with [LaTeX.css](https://latex.vercel.app/) for a clean, academic aesthetic.

### Features

-   **Interactive SMC Visualization**: A background simulation of a **Sequential Monte Carlo** algorithm tracking a moving multimodal distribution.
-   **Research**: Highlights my work on the mathematical foundations of machine learning.
-   **Photography**: A masonry gallery (`photography.html`) showcasing my photos.
-   **Writing**: My Substack posts (`writing.html`).

## Development

The site is lightweight with no build step.

-   **Math Rendering**: Uses [MathJax](https://www.mathjax.org/).
-   **Photography Metadata**: Run `python3 generate_metadata.py` to update photo data from EXIF tags.

## Deployment

Automatically deployed via **GitHub Pages** on push to `main`.
