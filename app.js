const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
var querystring = require("querystring");
var cookieParser = require("cookie-parser");

require("dotenv").config();
const cors = require("cors");

const app = express();
const port = 5000;

// Enable CORS for all routes

app.use(cors("*"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cookieParser());
app.use(express.static(__dirname + "/public"));

const { AuthorizationCode } = require("simple-oauth2");

const credentials = {
  client: {
    id: "370eb174f68e49cd89c059051d9f19a6",
    secret: "e20ef5d508e04d63a697abd41dadcf4a",
  },
  auth: {
    tokenHost: "https://accounts.spotify.com",
    authorizePath: "/authorize",
    tokenPath: "/api/token",
  },
};

const client = new AuthorizationCode(credentials);

// Redirect the user to Spotify's authorization page
const authorizationUri = client.authorizeURL({
  redirect_uri: "http://localhost:3000",
  scope: "playlist-modify-public",
  state: Math.random().toString(36).substring(7),
});

console.log("Redirecting to Spotify for authorization:", authorizationUri);

// Redirect the user to Spotify's authorization page

app.get("/login", (req, res, next) => {
  const authorizationUri = client.authorizeURL({
    redirect_uri: "http://localhost:3000",
    scope: "playlist-modify-public",
    state: Math.random().toString(32).substring(7),
  });
  res.status(200).json({ data: authorizationUri });

  // next();
});

// Handle the callback from Spotify
app.get("/get-access-token", async (req, res) => {
  try {
    const tokenRequestData = {
      grant_type: "authorization_code",
      code: req.query.code, // Replace with the code from the URL
      redirect_uri: "http://localhost:3000", // Must match the one in your initial authorization request
    };

    const authHeader =
      "Basic " +
      Buffer.from(
        `${credentials.client.id}:${credentials.client.secret}`
      ).toString("base64");

    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      querystring.stringify(tokenRequestData),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: authHeader,
        },
      }
    );

    res.status(200).json(response.data);
  } catch (error) {
    console.log(error.data);
  }
});

app.get("/search", async (req, res) => {
  const term = req.query.term; // Get the search term from the request query
  const accessToken = req.query.accessToken; // Get the access token from the request query

  try {
    const trackSearchResponse = await search(term, accessToken);
    res.status(200).json(trackSearchResponse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function search(term, accessToken) {
  const response = await axios.get(
    `https://api.spotify.com/v1/search?q=${term}&type=track&offset=0&limit=10`,
    // `https://api.spotify.com/v1/me/shows?offset=0&limit=20`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        // "X-RapidAPI-Key": "3426bad9cemshed8fe3f94a9b1ecp1ddf52jsnb1a05e26a78f",
        // "X-RapidAPI-Host": "spotify23.p.rapidapi.com",
      },
    }
  );

  const jsonResponse = response.data;
  if (!jsonResponse.tracks) {
    return [];
  }

  return jsonResponse.tracks.items.map((track) => ({
    id: track.id,
    name: track.name,
    artist: track.artists[0].name,
    album: track.album.name,
    uri: track.uri,
    imgs: track.preview_url,
  }));
}

// Step 1: Get the user's Spotify ID
async function getUserId(accessToken) {
  try {
    const userResponse = await axios.get("https://api.spotify.com/v1/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return userResponse.data.id;
  } catch (error) {
    throw new Error("Error getting user ID from Spotify API");
  }
}

// Step 2: Create a new playlist
async function createPlaylist(accessToken, userId, playlistName) {
  try {
    const createPlaylistResponse = await axios.post(
      `https://api.spotify.com/v1/users/${userId}/playlists`,
      {
        name: playlistName,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    return createPlaylistResponse.data.id;
  } catch (error) {
    throw new Error("Error creating a new playlist on Spotify");
  }
}

// Step 3: Add tracks to the playlist
async function addTracksToPlaylist(accessToken, playlistId, trackUris) {
  try {
    await axios.post(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      {
        uris: trackUris,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    throw new Error("Error adding tracks to the playlist on Spotify");
  }
}

// Implement your route for creating and saving a playlist
app.post("/createPlaylist", async (req, res) => {
  try {
    const { accessToken, name, trackUris } = req.body;

    // Step 1: Get the user's Spotify ID
    const userId = await getUserId(accessToken);

    // Step 2: Create a new playlist
    const playlistId = await createPlaylist(accessToken, userId, name);

    // Step 3: Add tracks to the playlist
    await addTracksToPlaylist(accessToken, playlistId, trackUris);

    res
      .status(200)
      .json({ message: "Playlist created and tracks added successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.listen(port, "localhost", () => {
  console.log(`Server is running on port http://localhost:${port}`);
});
