# Asset and dependency notices

## Design and original artwork

The application uses the uploaded Car Wash App design as visual direction: coral actions, white surfaces, rounded controls, mobile booking flows, provider details, a location overview and review screens. The source is a new implementation; it is not source code extracted from the reference image.

`public/images/carwash.png` is an original image generated with the built-in Image Generation tool for this application. It is also included in the compiled build. Different centre/gallery views reuse the same artwork with CSS framing and colour treatment. They are labelled illustrative and are not claimed to be real centre photographs.

Image prompt:

> Use case: photorealistic-natural. Asset type: wide hero photograph and service-card imagery for a premium car-wash booking web app. Create a single cinematic editorial photograph of a glossy unbranded silver-white sports sedan, three-quarter front view in a dark modern professional detailing bay, being sprayed with a fine mist of water, dense white foam on part of the bonnet, wet reflective black floor, soft coral-red accent light on the right, natural bright softbox daylight on silver bodywork, realistic droplets and luxurious detailing. The car is positioned toward the right half of a landscape 16:9 frame with usable dark negative space to the left for HTML headings. High quality automotive advertising photography, restrained palette dark charcoal, silver, white, coral. No text, no logo, no watermark, no collage, no people.

The small drop logo/favicon is a project-native SVG. The initial centres, vehicle, customer name and reviews are fictional/sample data. System fonts are used; there are no external font or image CDN requests.

## Libraries

The shipped frontend bundles React, React DOM, Scheduler and Lucide icons. Dependency license texts are included under `docs/licenses/`. The precise dependency graph is locked in `package-lock.json`.

| Package              | Use                                        |
| -------------------- | ------------------------------------------ |
| react                | Component runtime                          |
| react-dom            | Browser rendering                          |
| scheduler            | React scheduling                           |
| lucide-react         | Interface icons                            |
| vite                 | Development server and production bundling |
| @vitejs/plugin-react | React build integration                    |

Node.js and its bundled SQLite implementation are runtime prerequisites rather than redistributable binaries in this ZIP. See their official distributions for runtime licences.
