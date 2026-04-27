import type { ResearchResult } from "../shared/types";

interface ResearchPanelProps {
  data: ResearchResult;
}

export function ResearchPanel({ data }: ResearchPanelProps): JSX.Element {
  return (
    <section className="card research" aria-live="polite">
      <h3 className="research-title">AI research</h3>

      {data.company_data ? (
        <div className="research-section">
          <h4>{data.company_data.name}</h4>
          {data.company_data.description ? (
            <p className="muted">{data.company_data.description}</p>
          ) : null}
          <ul className="meta-row">
            {data.company_data.industry ? (
              <li>
                <span>Industry</span>
                {data.company_data.industry}
              </li>
            ) : null}
            {data.company_data.size ? (
              <li>
                <span>Size</span>
                {data.company_data.size}
              </li>
            ) : null}
            {data.company_data.website ? (
              <li>
                <span>Website</span>
                <a
                  href={data.company_data.website}
                  target="_blank"
                  rel="noreferrer"
                >
                  {new URL(data.company_data.website).host}
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {data.recent_news.length > 0 ? (
        <div className="research-section">
          <h4>Recent news</h4>
          <ul className="news">
            {data.recent_news.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.suggested_opener ? (
        <div className="research-section">
          <h4>Suggested cold opener</h4>
          <blockquote className="opener">{data.suggested_opener}</blockquote>
          <button
            type="button"
            className="btn-link"
            onClick={() => {
              void navigator.clipboard.writeText(data.suggested_opener);
            }}
          >
            Copy
          </button>
        </div>
      ) : null}

      {data.best_time ? (
        <div className="research-section">
          <h4>Best time to reach out</h4>
          <p>{data.best_time}</p>
        </div>
      ) : null}
    </section>
  );
}
