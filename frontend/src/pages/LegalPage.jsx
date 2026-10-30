import { Link } from 'react-router-dom';
import { legalContact, legalDocuments, legalUpdated } from '../data/legal';
import './LegalPage.css';

export default function LegalPage({ document }) {
  const policy = legalDocuments[document];
  return <article className="page legal-page">
    <Link to="/" className="legal-brand">Well Circle</Link>
    <h1>{policy.title}</h1>
    <p className="legal-updated">Last updated: {legalUpdated}</p>
    <p>{policy.intro}</p>
    <nav className="legal-navigation" aria-label="Legal information">
      {Object.values(legalDocuments).map(item => <Link key={item.path} to={item.path} aria-current={item.path === policy.path ? 'page' : undefined}>{item.title}</Link>)}
    </nav>
    {policy.sections.map(section => <section key={section.title}>
      <h2>{section.title}</h2>
      {section.paragraphs?.map(text => <p key={text}>{text}</p>)}
      {section.items && <ul>{section.items.map(text => <li key={text}>{text}</li>)}</ul>}
    </section>)}
    <footer>Contact: <a href={`mailto:${legalContact}`}>{legalContact}</a></footer>
  </article>;
}
