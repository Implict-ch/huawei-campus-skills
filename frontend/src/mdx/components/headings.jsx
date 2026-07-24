export function H2({ id, children }) {
  return (
    <h2 id={id} data-toc-id={id} className="problem-heading problem-heading--h2">
      {children}
    </h2>
  );
}

export function H3({ id, children }) {
  return (
    <h3 id={id} data-toc-id={id} className="problem-heading problem-heading--h3">
      {children}
    </h3>
  );
}
