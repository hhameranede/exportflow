import {
  extractReadableArticle,
  parseCsvText,
} from "../../src/core/open-source-parsers.js";

const repeatedText = [
  "ExportFlow validates public HTTP content before bounded extraction. ",
  "This test fixture uses local static markup and performs no network requests. ",
  "The Workers runtime must support the imported DOM parser and article extractor. ",
].join("").repeat(5);

const article = extractReadableArticle(
  "<!doctype html><html lang='en'><head><title>Worker parser fixture</title></head>" +
    "<body><article><h1>Worker parser fixture</h1><p>" +
    repeatedText +
    "</p><p>" + repeatedText + "</p></article></body></html>",
  { url: "https://parser-fixture.invalid/article" }
);
const csv = parseCsvText("name,value\nalpha,1\nbeta,2\n");

export default {
  async fetch() {
    return Response.json({
      status: "ok",
      articleStatus: article.status,
      articleTitle: article.title,
      articleHasExpectedText: article.textContent.includes("bounded extraction"),
      csvMethod: csv.method,
      csvRows: csv.rowCount,
    });
  },
};
