============== sys overview ============
1. one super admin (business owner), will set accounts for uploaders who will upload medias via api keys
2. uploaders login with gmail, as those were added by super admin, they can upload now, no clerk side check, it will be custom db checks.
3. uploader uploads the media then it will avaible via uploading pipeline.
4. once the post becomes live, it will be shown to viewers.
5. normal viewers will upload comments and like all those things, but upload is restricted to users who super admin added and handed the api key, it will be manual, as the super admin will do it manually.
6. there are alot of issues, with this, for video uploads, to streamlander, there might be fails and other crash things which needs to be handled with wal file or similar, persistance queue, so next time when system boots back up it will continue where it left, and there will be exponential backoff, proper db logs, and super admin dashboard to view all these issues, and delete posts, which super admin can do that., uploaders can only upload and see there posts, and when a post is being uploaded, show pending status for uploaders.

7. [not for this project] streamlander is fast, but its microservice, so it has to be webhook kind of a thing. for now streamlander will run of a dedicated server, where the storage is huge but not infinite. so it has to be resilient, and it has to be a fail retry basesd system as well
