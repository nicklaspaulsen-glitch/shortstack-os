import { NextPageContext } from "next";

function Error({ statusCode }: { statusCode?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui, sans-serif", background: "#020711" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "3rem", fontWeight: 700, margin: 0, color: "#D4FF00" }}>
          {statusCode || "Error"}
        </h1>
        <p style={{ color: "#A8A8B2", marginTop: "0.5rem" }}>
          {statusCode === 404 ? "Page not found" : "Something went wrong"}
        </p>
        <a href="/dashboard" style={{ color: "#D4FF00", fontSize: "0.875rem", marginTop: "1rem", display: "inline-block" }}>
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
