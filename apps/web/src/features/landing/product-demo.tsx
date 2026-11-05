import './product-demo.css';

export function ProductDemo() {
  return (
    <section className="landing-block product-demo" aria-labelledby="product-demo-title">
      <div className="product-demo-copy">
        <h2 id="product-demo-title">
          See RenovAgent <em>in action</em>
        </h2>
        <p>
          From a real room to a renovation plan. Watch how RenovAgent brings together AI
          visualization, 3D layouts, material estimates, and practical planning tools to help you
          explore what’s possible before you build.
        </p>
      </div>
      <a
        className="product-demo-video"
        href="https://www.youtube.com/watch?v=E97iGaoiMz4"
        target="_blank"
        rel="noreferrer"
        aria-label="Watch the 3-minute RenovAgent demo on YouTube (opens in a new tab)"
      >
        <span className="product-demo-thumbnail">
          <img
            src="https://img.youtube.com/vi/E97iGaoiMz4/hqdefault.jpg"
            alt=""
            width={480}
            height={360}
            loading="lazy"
            decoding="async"
          />
          <span className="product-demo-play" aria-hidden="true">
            ▶
          </span>
        </span>
        <span className="product-demo-caption">Watch the 3-minute demo</span>
      </a>
    </section>
  );
}
