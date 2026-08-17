import 'dotenv/config';

const QUERY = `
query products($filter: ProductAttributeFilterInput, $pageSize: Int, $currentPage: Int) {
  products(filter: $filter, pageSize: $pageSize, currentPage: $currentPage) {
    total_count
    page_info { total_pages page_size }
  }
}`;

async function count(filter, label) {
  const res = await fetch('https://app.psp.ge/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { filter, pageSize: 100, currentPage: 1 } }),
  });
  const json = await res.json();
  console.log(label, json.data?.products?.total_count, 'pages', json.data?.products?.page_info?.total_pages);
}

await count({ category_id: { eq: '823' } }, 'cat 823');
await count(null, 'all products');
await count({ category_id: { in: ['823', '1554', '2035'] } }, '823+1554+2035');
