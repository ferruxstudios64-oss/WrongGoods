import Link from 'next/link';
export default function NotFound(){return <main id="main" className="lost-page">
  <p className="eyebrow">404 / LOST PROPERTY</p><h1>THE GOODS<br/>GOT AWAY.</h1><p>That page does not exist. The catalogue does.</p><Link className="button" href="/goods">Back to the goods ↗</Link>
</main>}