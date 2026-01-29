
### how i want my things

```py

class PostsAnalytics():
    def __init__(self, post_id: str, user_id: str, action: enum{"play", "pause" .....}, created_at: datetime):
        # data set
        return self

    def get_score(self):
        return POSTS_WEIGHTAGE[self.action]

class PostAnalyticsState:
    start_time: datetime
    hot_posts: list[str]
    most_played: list[str]


class PostAnalyticsParser():
    def __init__(self, posts: list[PostsAnalytics], prev_state: PostAnalyticsState):
        return self

    def calc_current_hot_post(self):
        # get the current hot post from the streams that isnt saved yet in file, calculate with mem eve, and then prev state is given
        # tally and update
        pass
    
    def tally_with_prev(self):
        pass
    
    def save_current_state(self):
        pass

    def summerize(self):
        pass
        # common method for all, so that it can follow solid principas
    
    


class AnalyticsManager():
    pass
    # wait for N events, have a post_state
    # save to file
    # save all incoming events to wal file
    # handle things like this, incase of error, the last stream can be pulled and cacluate, and always hold the prev state
    # everything is persistence.


    # PostAnalytics and NewVistors(it will have a module like PostAnalytics too), .... more modules like this to calculate the analytics



```