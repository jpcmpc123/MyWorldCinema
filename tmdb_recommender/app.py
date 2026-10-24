"""
Servidor Web FastAPI para Recomendação de Filmes com Laya + TMDB.
Carrega o modelo 100% treinado e calibrado direto da nuvem: Jpcm/laya-filmes-tmdb.
"""

import os
import re
import json
import urllib.parse
import urllib.request
from fastapi import FastAPI, Query
import laya

app = FastAPI(title="Laya TMDB Movie Recommender API (Jpcm/laya-filmes-tmdb)")

BASE_DIR = os.path.dirname(__file__)
QUESTIONS_PATH = os.path.join(BASE_DIR, "movie_questions.json")
TMDB_KEY = (
    os.environ.get("TMDB_API_KEY")
    or os.environ.get("TMDB_READ_TOKEN")
    or "756b66f23e97ca70dba67363ba4e3b21"
)

# Puxa o seu modelo 100% treinado e calibrado direto da nuvem!
print("[API] Carregando modelo Laya: Jpcm/laya-filmes-tmdb")
agent = laya.load("Jpcm/laya-filmes-tmdb")

with open(QUESTIONS_PATH, "r", encoding="utf-8") as f:
    questions = json.load(f)

TMDB_GENRE_MAP = {
    "action": 28, "adventure": 12, "animation": 16, "comedy": 35,
    "crime": 80, "documentary": 99, "drama": 18, "family": 10751,
    "fantasy": 14, "history": 36, "horror": 27, "music": 10402,
    "mystery": 9648, "romance": 10749, "scifi": 878, "thriller": 53,
    "war": 10752, "western": 37
}

DECADE_YEAR_MAP = {
    "classic": ("1920-01-01", "1979-12-31"),
    "80s": ("1980-01-01", "1989-12-31"),
    "90s": ("1990-01-01", "1999-12-31"),
    "2000s": ("2000-01-01", "2009-12-31"),
    "modern": ("2010-01-01", "2025-12-31")
}

ORIGIN_MAP = {
    "japanese": {"with_original_language": "ja"},
    "korean": {"with_original_language": "ko"},
    "national": {"with_origin_country": "BR", "with_original_language": "pt"},
    "european": {"with_origin_country": "FR|IT|ES|GB|DE"},
    "hollywood": {"with_original_language": "en"},
    "asian": {"with_original_language": "zh|cn|th|hi|id"}
}


def extract_val(ans):
    if isinstance(ans, dict):
        return ans.get("choice", ans.get("value"))
    return ans


def format_movie_item(m):
    poster_path = m.get("poster_path")
    poster_url = f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None
    return {
        "id": m.get("id"),
        "title": m.get("title") or m.get("name") or "Sem título",
        "original_title": m.get("original_title") or m.get("title") or "",
        "poster_path": poster_path,
        "backdrop_path": m.get("backdrop_path"),
        "overview": m.get("overview") or "Sem sinopse disponível.",
        "vote_average": m.get("vote_average", 0),
        "release_date": m.get("release_date", ""),
        "poster_url": poster_url,
    }


def search_reference_movie(user_prompt: str):
    ref_match = re.search(
        r"(?:estilo\s+(?:de\s+)?|tipo\s+|gosto\s+(?:muito\s+)?de\s+|parecido\s+com\s+|adorei\s+|amo\s+)([\w\s\:\-\'\’À-ÿ]+?)(?:,|\.|$|\se\s|\spara\s|\smas\s|\scom\s)",
        user_prompt,
        re.IGNORECASE,
    )
    if not ref_match:
        return None
    cand_title = ref_match.group(1).strip()
    cand_title = re.sub(r"^(o|a|os|as|um|uma)\s+", "", cand_title, flags=re.IGNORECASE)
    if len(cand_title) <= 2 or cand_title.lower() in ["filme", "filmes", "cinema", "serie", "série"]:
        return None

    url = f"https://api.themoviedb.org/3/search/movie?query={urllib.parse.quote(cand_title)}&language=pt-BR"
    headers = {"User-Agent": "LayaAPI/1.0", "accept": "application/json"}
    if len(TMDB_KEY) > 50:
        headers["Authorization"] = f"Bearer {TMDB_KEY}"
    else:
        url += f"&api_key={TMDB_KEY}"
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            results = data.get("results", [])
            return results[0] if results else None
    except Exception:
        return None


def query_similar_tmdb(movie_id: int):
    url = f"https://api.themoviedb.org/3/movie/{movie_id}/recommendations?language=pt-BR&page=1"
    headers = {"User-Agent": "LayaAPI/1.0", "accept": "application/json"}
    if len(TMDB_KEY) > 50:
        headers["Authorization"] = f"Bearer {TMDB_KEY}"
    else:
        url += f"&api_key={TMDB_KEY}"
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            results = [m for m in data.get("results", []) if m.get("poster_path")]
            return [format_movie_item(m) for m in results[:4]]
    except Exception:
        return []


def query_tmdb(genre, rating, decade, origin):
    genre_id = TMDB_GENRE_MAP.get(genre)
    base_url = "https://api.themoviedb.org/3/discover/movie"
    d_start, d_end = DECADE_YEAR_MAP.get(decade, DECADE_YEAR_MAP["modern"])
    origin_params = ORIGIN_MAP.get(origin, {})
    is_national = origin == "national"
    is_asian = origin in ["korean", "japanese", "asian"]

    tiers = [
        {
            **origin_params,
            **({"with_genres": str(genre_id)} if genre_id else {}),
            "primary_release_date.gte": d_start,
            "primary_release_date.lte": d_end,
            **(
                {"certification_country": "BR", "certification.lte": rating}
                if rating in ["L", "10", "12", "14", "16", "18"] and not is_asian
                else {}
            ),
            "vote_count.gte": "8" if is_national else ("40" if is_asian else "50"),
            "sort_by": "vote_count.desc" if is_asian else "popularity.desc",
        },
        {
            **origin_params,
            **({"with_genres": str(genre_id)} if genre_id else {}),
            "primary_release_date.gte": d_start,
            "primary_release_date.lte": d_end,
            "vote_count.gte": "3" if is_national else ("25" if is_asian else "30"),
            "sort_by": "vote_count.desc" if is_asian else "popularity.desc",
        },
        {
            **origin_params,
            **({"with_genres": str(genre_id)} if genre_id else {}),
            "primary_release_date.lte": "2025-12-31",
            "vote_count.gte": "2" if is_national else "15",
            "sort_by": "popularity.desc",
        },
        {
            **({"with_genres": str(genre_id)} if genre_id else {}),
            "primary_release_date.gte": d_start,
            "primary_release_date.lte": d_end,
            "vote_count.gte": "40",
            "sort_by": "popularity.desc",
        },
    ]

    headers = {"User-Agent": "LayaAPI/1.0", "accept": "application/json"}
    if len(TMDB_KEY) > 50:
        headers["Authorization"] = f"Bearer {TMDB_KEY}"

    collected = []
    seen_ids = set()

    for tier in tiers:
        if len(collected) >= 4:
            break
        params = {
            "language": "pt-BR",
            "include_adult": "false",
            "page": "1",
            **tier,
        }
        if len(TMDB_KEY) <= 50:
            params["api_key"] = TMDB_KEY
        url = f"{base_url}?{urllib.parse.urlencode(params)}"
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                results = [m for m in data.get("results", []) if m.get("poster_path")]
                for m in results:
                    if m.get("id") not in seen_ids:
                        seen_ids.add(m.get("id"))
                        collected.append(format_movie_item(m))
                        if len(collected) >= 4:
                            break
        except Exception as e:
            print(f"Erro na chamada TMDB: {e}")

    return collected[:4]


@app.get("/api/recommend")
def api_recommend(q: str = Query(..., description="Pedido em linguagem natural")):
    prediction = agent.predict(q, questions)
    answers = prediction.get("answers", {})

    genre = extract_val(answers.get("genre"))
    mood = extract_val(answers.get("mood"))
    rating = extract_val(answers.get("content_rating"))
    decade = extract_val(answers.get("decade"))
    origin = extract_val(answers.get("origin"))
    pacing = extract_val(answers.get("pacing"))
    viewing_context = extract_val(answers.get("viewing_context"))

    ref_movie = search_reference_movie(q)
    movies = []
    if ref_movie and ref_movie.get("id"):
        movies = query_similar_tmdb(ref_movie["id"])

    if len(movies) < 4:
        discovered = query_tmdb(genre, rating, decade, origin)
        existing_ids = {m["id"] for m in movies}
        for m in discovered:
            if m["id"] not in existing_ids:
                movies.append(m)
                if len(movies) >= 4:
                    break

    return {
        "query": q,
        "model": "Jpcm/laya-filmes-tmdb",
        "reference_movie": ref_movie.get("title") if ref_movie else None,
        "decisions": {
            "genre": genre,
            "mood": mood,
            "content_rating": rating,
            "decade": decade,
            "origin": origin,
            "pacing": pacing,
            "viewing_context": viewing_context,
        },
        "movies": movies[:4]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("tmdb_recommender.app:app", host="0.0.0.0", port=8000, reload=False)
