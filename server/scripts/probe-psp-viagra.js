import 'dotenv/config';

const QUERY = `
query products($filter: ProductAttributeFilterInput, $search: String, $pageSize: Int) {
  products(filter: $filter, search: $search, pageSize: $pageSize) {
    total_count
    items { id name categories { id name } }
  }
}`;

const res = await fetch('https://app.psp.ge/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({
    query: QUERY,
    variables: {
      search: 'ვიაგრ',
      filter: { category_id: { eq: '823' } },
      pageSize: 10,
    },
  }),
});
const json = await res.json();
console.log('in cat 823:', json.data?.products?.total_count);
json.data?.products?.items?.forEach((i) => console.log(i.id, i.name, i.categories?.map((c) => c.id)));

const res2 = await fetch('https://app.psp.ge/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({
    query: QUERY,
    variables: { search: 'ვიაგრ', pageSize: 10 },
  }),
});
const json2 = await res2.json();
console.log('\nno filter:', json2.data?.products?.total_count);
json2.data?.products?.items?.forEach((i) => console.log(i.id, i.name, i.categories?.map((c) => c.id + ':' + c.name)));
